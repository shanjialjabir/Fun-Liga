import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createCompetition, applyCommand } from "../src/lib/competition";
vi.mock("server-only", () => ({}));
let store: typeof import("../src/lib/store");
let owner: { id: string; email: string; name: string };
const directory = mkdtempSync(join(tmpdir(), "fms-committee-store-"));
beforeAll(async () => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("DEMO_DATA_DIR", directory);
  store = await import("../src/lib/store");
  owner = store.demoLogin("link-owner@store.test", "Owner").user;
});
afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
async function create() {
  const c = createCompetition(
    {
      name: "Link store verification",
      format: "fourfeo",
      visibility: "private",
      teamNames: ["A", "B", "C", "D"],
    },
    owner,
  );
  await store.saveCompetition(c);
  return c;
}
const request = (token: string) =>
  new Request("https://example.test/api/session", {
    headers: { cookie: `fms_committee=${token}` },
  });
describe("Server persistence for account-free committee sessions", () => {
  it("opens a reusable grant in multiple independent sessions without creating any account or membership", async () => {
    const c = await create();
    const before = await store.listManagedAccounts();
    const { token } = await store.createCommitteeLink(
      c,
      owner,
      "score_operator",
      "Operator lapangan",
    );
    const first = await store.openCommitteeLink(token);
    const second = await store.openCommitteeLink(token);
    expect(first.user).toEqual(second.user);
    expect(first.user.guest).toBe(true);
    expect(first.user.role).toBe("score_operator");
    expect(first.competition.members).toHaveLength(1);
    expect(await store.listManagedAccounts()).toEqual(before);
    expect((await store.currentUser(request(token)))?.competitionId).toBe(c.id);
    expect(first.link.tokenHash).not.toBe(token);
    expect(
      await store.currentUser(
        request(createHash("sha256").update(token).digest("hex")),
      ),
    ).toBeNull();
  });
  it("converts an unused legacy invitation without login and keeps it reusable with its original role", async () => {
    const c = await create();
    const token = await store.createInvite(
      c.id,
      "admin",
      "legacy@example.test",
    );
    const opened = await store.openCommitteeLink(token);
    expect(opened.user.role).toBe("admin");
    expect(opened.competition.members).toHaveLength(1);
    expect((await store.openCommitteeLink(token)).user.id).toBe(opened.user.id);
    expect(
      ((await store.listInvites(c.id)) as { accepted_at: number }[])[0]
        .accepted_at,
    ).toBeTruthy();
  });
  it("revocation and expiration invalidate cookies and prevent opening the link again", async () => {
    const c = await create();
    const { token } = await store.createCommitteeLink(
      c,
      owner,
      "score_operator",
      "",
    );
    const access = await store.openCommitteeLink(token);
    const revoked = applyCommand(access.competition, owner, {
      type: "revoke_committee_link",
      linkId: access.link.id,
      version: access.competition.version,
    });
    await store.saveCompetition(revoked, access.competition.version);
    expect(await store.currentUser(request(token))).toBeNull();
    await expect(store.openCommitteeLink(token)).rejects.toThrow("tidak valid");
    const another = await store.createCommitteeLink(
      revoked,
      owner,
      "admin",
      "",
    );
    const fresh = (await store.openCommitteeLink(another.token)).competition;
    const previous = fresh.version;
    fresh.committeeLinks![0].expiresAt = Date.now() - 1;
    fresh.version++;
    await store.saveCompetition(fresh, previous);
    expect(await store.currentUser(request(another.token))).toBeNull();
    await expect(store.openCommitteeLink(another.token)).rejects.toThrow(
      "kedaluwarsa",
    );
  });
  it("never reactivates a converted legacy invitation after the access is revoked", async () => {
    const c = await create();
    const token = await store.createInvite(c.id, "score_operator", null);
    const access = await store.openCommitteeLink(token);
    const revoked = applyCommand(access.competition, owner, {
      type: "revoke_committee_link",
      linkId: access.link.id,
      version: access.competition.version,
    });
    await store.saveCompetition(revoked, access.competition.version);
    await expect(store.openCommitteeLink(token)).rejects.toThrow("tidak valid");
  });
  it("rejects stale link creation without overwriting another admin's access", async () => {
    const c = await create();
    const first = await store.createCommitteeLink(c, owner, "admin", "");
    await expect(
      store.createCommitteeLink(c, owner, "score_operator", ""),
    ).rejects.toThrow("Konflik");
    expect(
      (await store.openCommitteeLink(first.token)).competition.committeeLinks,
    ).toHaveLength(1);
  });
});
