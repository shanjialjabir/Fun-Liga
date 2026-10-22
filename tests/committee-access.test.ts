import { describe, it, expect } from "vitest";
import {
  applyCommand,
  createCompetition,
  roleFor,
  canView,
} from "../src/lib/competition";
const owner = { id: crypto.randomUUID(), email: "owner-links@example.test" };
function setup() {
  const c = createCompetition(
    {
      name: "Private link competition",
      format: "fourfeo",
      visibility: "private",
      teamNames: ["A", "B", "C", "D"],
    },
    owner,
  );
  c.committeeLinks = [
    {
      id: crypto.randomUUID(),
      role: "score_operator",
      label: "Lapangan 1",
      expiresAt: Date.now() + 3600000,
    },
    {
      id: crypto.randomUUID(),
      role: "admin",
      label: "Panitia utama",
      expiresAt: Date.now() + 3600000,
    },
  ];
  return c;
}
describe("Account-free committee capabilities", () => {
  it("grants the chosen role only for the linked competition without changing registered membership", () => {
    const c = setup();
    const op = `link:${c.committeeLinks![0].id}`;
    expect(roleFor(c, op)).toBe("score_operator");
    expect(canView(c, op)).toBe(true);
    expect(c.members).toHaveLength(1);
    expect(roleFor(c, c.committeeLinks![0].id)).toBeUndefined();
    expect(canView(setup(), op)).toBe(false);
  });
  it("legacy expiration no longer limits access, while revocation still removes it", () => {
    const c = setup();
    const id = `link:${c.committeeLinks![0].id}`;
    c.committeeLinks![0].expiresAt = Date.now() - 1;
    expect(roleFor(c, id)).toBe("score_operator");
    expect(canView(c, id)).toBe(true);
    c.committeeLinks = [];
    expect(() =>
      applyCommand(
        c,
        { id, email: "guest" },
        { type: "publish", version: c.version },
      ),
    ).toThrow("akses");
    const current = setup();
    const link = current.committeeLinks![0];
    const result = applyCommand(current, owner, {
      type: "revoke_committee_link",
      linkId: link.id,
      version: current.version,
    });
    expect(canView(result, `link:${link.id}`)).toBe(false);
    expect(result.audit.at(-1)?.event).toBe("revoke_committee_link");
  });
  it("operators can record results but cannot change settings, draw schedules, invite or revoke roles", () => {
    const c = setup();
    const user = { id: `link:${c.committeeLinks![0].id}`, email: "guest" };
    c.status = "published";
    const match = c.matches[0];
    const result = applyCommand(c, user, {
      type: "finalize",
      version: c.version,
      matchId: match.id,
      matchVersion: match.version,
      homeScore: 2,
      awayScore: 1,
      confirm: true,
    });
    expect(result.matches[0].status).toBe("final");
    for (const type of [
      "settings",
      "shuffle_schedule",
      "revoke_committee_link",
      "transfer",
      "teams",
    ])
      expect(() => applyCommand(c, user, { type, version: c.version })).toThrow(
        "owner atau admin",
      );
  });
  it("link admins retain competition permissions but cannot become owner or revoke other admins", () => {
    const c = setup();
    const user = { id: `link:${c.committeeLinks![1].id}`, email: "guest" };
    const settings = {
      name: c.name,
      description: "Guest admin edit",
      venue: "",
      visibility: "private",
    };
    expect(
      applyCommand(c, user, { type: "settings", version: c.version, settings })
        .description,
    ).toBe(settings.description);
    expect(() =>
      applyCommand(c, user, { type: "transfer", version: c.version }),
    ).toThrow("Hanya owner");
    expect(() =>
      applyCommand(c, user, {
        type: "revoke_committee_link",
        version: c.version,
        linkId: c.committeeLinks![1].id,
      }),
    ).toThrow("Hanya owner");
    expect(
      applyCommand(c, user, {
        type: "revoke_committee_link",
        version: c.version,
        linkId: c.committeeLinks![0].id,
      }).committeeLinks,
    ).toHaveLength(1);
  });
});
