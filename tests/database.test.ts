import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createCompetition, applyCommand } from "../src/lib/competition";
let pg: PGlite;
const owner = { id: crypto.randomUUID(), email: "owner@database.test" };
const stranger = crypto.randomUUID();
const c = createCompetition(
  {
    name: "Postgres tests",
    format: "fourfeo",
    teamNames: ["A", "B", "C", "D"],
    visibility: "private",
  },
  owner,
);
async function asRole<T>(
  role: string,
  uid: string | null,
  sql: string,
  params: unknown[] = [],
) {
  return pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${role}`);
    if (uid)
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        uid,
      ]);
    return tx.query<T>(sql, params);
  });
}
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role; CREATE PUBLICATION supabase_realtime;`,
  );
  await pg.query("INSERT INTO auth.users VALUES($1),($2)", [
    owner.id,
    stranger,
  ]);
  await pg.exec(
    await readFile("supabase/migrations/001_competitions.sql", "utf8"),
  );
  await asRole(
    "service_role",
    null,
    "SELECT public.save_competition($1::jsonb,null)",
    [JSON.stringify(c)],
  );
}, 20000);
afterAll(async () => {
  await pg?.close();
});
describe("PostgreSQL migration, RLS and transactional RPC", () => {
  it("deletes only the matching owner/version/name and cascades related data", async () => {
    const target = createCompetition(
      {
        name: "Delete database test",
        format: "fourfeo",
        teamNames: ["A", "B", "C", "D"],
        visibility: "private",
      },
      owner,
    );
    await asRole(
      "service_role",
      null,
      "SELECT save_competition($1::jsonb,null)",
      [JSON.stringify(target)],
    );
    await pg.query(
      "INSERT INTO competition_invites(token_hash,competition_id,role,expires_at) VALUES($1,$2,'admin',$3)",
      ["delete-invite", target.id, Date.now() + 60000],
    );
    await expect(
      asRole(
        "authenticated",
        owner.id,
        "DELETE FROM competitions WHERE id=$1",
        [target.id],
      ),
    ).rejects.toThrow("permission denied");
    const sql =
      "DELETE FROM competitions WHERE id=$1 AND owner_user_id=$2 AND version=$3 AND data->>'name'=$4 RETURNING id";
    for (const params of [
      [target.id, stranger, target.version, target.name],
      [target.id, owner.id, target.version + 1, target.name],
      [target.id, owner.id, target.version, "Wrong name"],
    ])
      expect(
        (await asRole("service_role", null, sql, params)).rows,
      ).toHaveLength(0);
    expect(
      (
        await asRole("service_role", null, sql, [
          target.id,
          owner.id,
          target.version,
          target.name,
        ])
      ).rows,
    ).toEqual([{ id: target.id }]);
    for (const table of [
      "competitions",
      "competition_members",
      "competition_invites",
      "competition_events",
    ])
      expect(
        (
          await pg.query(
            `SELECT * FROM ${table} WHERE ${table === "competitions" ? "id" : "competition_id"}=$1`,
            [target.id],
          )
        ).rows,
      ).toHaveLength(0);
    expect(
      (await pg.query("SELECT id FROM competitions WHERE id=$1", [c.id])).rows,
    ).toHaveLength(1);
  });
  it("stores aggregate and owner membership", async () => {
    const result = await pg.query<{ data: typeof c }>(
      "SELECT data FROM competitions WHERE id=$1",
      [c.id],
    );
    expect(result.rows[0].data).toEqual(c);
    const members = await pg.query(
      "SELECT role FROM competition_members WHERE competition_id=$1",
      [c.id],
    );
    expect(members.rows).toEqual([{ role: "owner" }]);
  });
  it("does not expose private data or events to unauthenticated or unrelated users", async () => {
    await expect(
      asRole("anon", null, "SELECT data FROM competitions"),
    ).rejects.toThrow("permission denied");
    expect(
      (await asRole("authenticated", stranger, "SELECT data FROM competitions"))
        .rows,
    ).toEqual([]);
    expect(
      (await asRole("anon", null, "SELECT * FROM competition_events")).rows,
    ).toEqual([]);
    expect(
      (
        await asRole(
          "authenticated",
          stranger,
          "SELECT * FROM competition_events",
        )
      ).rows,
    ).toEqual([]);
  });
  it("permits owner snapshot access", async () => {
    const result = await asRole<{ data: typeof c }>(
      "authenticated",
      owner.id,
      "SELECT data FROM competitions",
    );
    expect(result.rows[0].data.id).toBe(c.id);
  });
  it("rejects direct client writes and server RPC bypass", async () => {
    await expect(
      asRole(
        "authenticated",
        owner.id,
        "UPDATE competitions SET status='published'",
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      asRole("anon", null, "SELECT save_competition($1::jsonb,null)", [
        JSON.stringify(c),
      ]),
    ).rejects.toThrow("permission denied");
    await expect(
      asRole(
        "authenticated",
        owner.id,
        "SELECT save_competition($1::jsonb,null)",
        [JSON.stringify(c)],
      ),
    ).rejects.toThrow("permission denied");
  });
  it("compare-and-swap rejects stale writes without partially replacing members or audit", async () => {
    const next = applyCommand(c, owner, { type: "publish", version: 0 });
    await asRole("service_role", null, "SELECT save_competition($1::jsonb,0)", [
      JSON.stringify(next),
    ]);
    const bad = { ...next, name: "lost update", members: [] };
    await expect(
      asRole("service_role", null, "SELECT save_competition($1::jsonb,0)", [
        JSON.stringify(bad),
      ]),
    ).rejects.toThrow("version conflict");
    const rows = await pg.query<{ data: typeof c }>(
      "SELECT data FROM competitions WHERE id=$1",
      [c.id],
    );
    expect(rows.rows[0].data.name).toBe(c.name);
    expect(rows.rows[0].data.audit).toHaveLength(1);
    expect(
      (await pg.query("SELECT * FROM competition_members")).rows,
    ).toHaveLength(1);
  });
  it("safe realtime events become public only after public publication", async () => {
    const snapshot = (
      await pg.query<{ data: typeof c }>(
        "SELECT data FROM competitions WHERE id=$1",
        [c.id],
      )
    ).rows[0].data;
    const next = applyCommand(snapshot, owner, {
      type: "settings",
      version: snapshot.version,
      settings: {
        name: c.name,
        description: "",
        venue: "",
        visibility: "public",
      },
    });
    await asRole(
      "service_role",
      null,
      "SELECT save_competition($1::jsonb,$2)",
      [JSON.stringify(next), snapshot.version],
    );
    const events = await asRole(
      "anon",
      null,
      "SELECT * FROM competition_events",
    );
    expect(events.rows).toHaveLength(1);
    expect(Object.keys(events.rows[0] as object).sort()).toEqual([
      "competition_id",
      "updated_at",
      "version",
    ]);
  });
  it("consumes an invite and competition membership in one transaction", async () => {
    const snapshot = (
      await pg.query<{ data: typeof c }>(
        "SELECT data FROM competitions WHERE id=$1",
        [c.id],
      )
    ).rows[0].data;
    await pg.query(
      "INSERT INTO competition_invites(token_hash,competition_id,role,expires_at) VALUES($1,$2,$3,$4)",
      ["hash-test", c.id, "score_operator", Date.now() + 60000],
    );
    const next = structuredClone(snapshot);
    next.version++;
    next.members.push({
      userId: stranger,
      email: "operator@database.test",
      role: "score_operator",
    });
    await asRole(
      "service_role",
      null,
      "SELECT accept_competition_invite($1::jsonb,$2,$3)",
      [JSON.stringify(next), snapshot.version, "hash-test"],
    );
    await expect(
      asRole(
        "service_role",
        null,
        "SELECT accept_competition_invite($1::jsonb,$2,$3)",
        [JSON.stringify(next), snapshot.version, "hash-test"],
      ),
    ).rejects.toThrow("invite unavailable");
    expect(
      (
        await pg.query("SELECT * FROM competition_members WHERE user_id=$1", [
          stranger,
        ])
      ).rows,
    ).toHaveLength(1);
  });
});
