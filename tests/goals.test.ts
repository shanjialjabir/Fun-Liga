import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createCompetition,
  playerStatistics,
  standings,
  type Competition,
} from "../src/lib/competition";
const owner = { id: crypto.randomUUID(), email: "owner-goals@example.test" };
const operator = {
  id: crypto.randomUUID(),
  email: "operator-goals@example.test",
};
const stranger = {
  id: crypto.randomUUID(),
  email: "stranger-goals@example.test",
};
function setup(format: "fourfeo" | "knockout" = "fourfeo") {
  let c = createCompetition(
    {
      name: "Goal tests",
      format,
      teamNames: ["Garuda", "Elang", "Singa", "Rajawali"],
    },
    owner,
  );
  c = applyCommand(c, owner, { type: "publish", version: c.version });
  c.members.push({
    userId: operator.id,
    email: operator.email,
    role: "score_operator",
  });
  return c;
}
function command(
  c: Competition,
  input: Record<string, unknown>,
  user = owner,
  index = 0,
) {
  const m = c.matches[index];
  return applyCommand(c, user, {
    version: c.version,
    matchId: m.id,
    matchVersion: m.version,
    ...input,
  });
}
function goal(c: Competition, input: Record<string, unknown> = {}, index = 0) {
  return command(
    c,
    {
      type: "goal_add",
      teamId: c.matches[index].home,
      scorerName: "Andi Saputra",
      assistName: "Budi Santoso",
      minute: 5,
      ...input,
    },
    operator,
    index,
  );
}
function final(c: Competition, index = 0) {
  const m = c.matches[index];
  return command(
    c,
    {
      type: "finalize",
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      confirm: true,
    },
    owner,
    index,
  );
}
describe("Goal ledger, player identity and statistics", () => {
  it("records scorer and assist atomically with automatic score, live status and audit", () => {
    const original = setup();
    const c = goal(original);
    const m = c.matches[0];
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(0);
    expect(m.status).toBe("live");
    expect(m.version).toBe(original.matches[0].version + 1);
    expect(c.version).toBe(original.version + 1);
    expect(c.players).toHaveLength(2);
    expect(m.goals?.[0]).toMatchObject({
      scorerName: "Andi Saputra",
      assistName: "Budi Santoso",
      minute: 5,
      ownGoal: false,
    });
    expect(c.audit.at(-1)?.event).toBe("goal_add");
    expect(original.players).toBeUndefined();
    expect(playerStatistics(c)).toEqual([]);
    expect(standings(c).every((r) => r.points === 0)).toBe(true);
  });
  it("uses the same per-team identities across roles, whitespace, casing and fixtures", () => {
    let c = goal(setup());
    c = goal(c, {
      scorerName: "  bUdI   SANTOSO  ",
      assistName: "ANDI SAPUTRA",
    });
    expect(c.players).toHaveLength(2);
    expect(c.matches[0].goals?.[1].scorerId).toBe(
      c.matches[0].goals?.[0].assistId,
    );
    expect(c.matches[0].goals?.[1].scorerName).toBe("Budi Santoso");
    c = goal(c, {
      teamId: c.matches[0].away,
      scorerName: "Andi Saputra",
      assistName: "",
    });
    expect(c.players).toHaveLength(3);
    expect(c.matches[0].homeScore).toBe(2);
    expect(c.matches[0].awayScore).toBe(1);
  });
  it("credits own goals to opponents and excludes them from both leaderboards", () => {
    let c = goal(setup(), { ownGoal: true, assistName: "" });
    expect(c.matches[0].homeScore).toBe(0);
    expect(c.matches[0].awayScore).toBe(1);
    c = final(c);
    expect(playerStatistics(c)).toEqual([]);
    expect(() => goal(setup(), { ownGoal: true })).toThrow(
      "tidak memiliki assist",
    );
  });
  it("edits metadata without changing score, deletes a goal and decrements only its beneficiary", () => {
    let c = goal(setup());
    const gid = c.matches[0].goals![0].id;
    c = command(c, {
      type: "goal_update",
      goalId: gid,
      teamId: c.matches[0].home,
      scorerName: "Dani",
      assistName: "Andi Saputra",
      minute: 9,
    });
    expect(c.matches[0].homeScore).toBe(1);
    expect(c.matches[0].goals![0].id).toBe(gid);
    c = command(c, { type: "goal_delete", goalId: gid });
    expect(c.matches[0].homeScore).toBe(0);
    expect(c.matches[0].goals).toEqual([]);
    expect(c.players?.some((p) => p.name === "Dani")).toBe(true);
    expect(() => command(c, { type: "goal_delete", goalId: gid })).toThrow(
      "tidak ditemukan",
    );
  });
  it("counts only final goals and assists, with audited final corrections requiring reason and confirmation", () => {
    let c = final(goal(setup()));
    const g = c.matches[0].goals![0];
    expect(playerStatistics(c)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Andi Saputra", goals: 1, assists: 0 }),
        expect.objectContaining({ name: "Budi Santoso", goals: 0, assists: 1 }),
      ]),
    );
    expect(() => command(c, { type: "goal_delete", goalId: g.id })).toThrow(
      "konfirmasi",
    );
    expect(() =>
      command(c, {
        type: "goal_delete",
        goalId: g.id,
        confirm: true,
        reason: "no",
      }),
    ).toThrow();
    c = command(c, {
      type: "goal_delete",
      goalId: g.id,
      confirm: true,
      reason: "Gol dibatalkan oleh wasit",
    });
    expect(c.matches[0].status).toBe("final");
    expect(c.matches[0].homeScore).toBe(0);
    expect(playerStatistics(c)).toEqual([]);
    expect(c.audit.at(-1)).toMatchObject({
      event: "goal_delete",
      reason: "Gol dibatalkan oleh wasit",
    });
    expect((c.audit.at(-1)?.before as { homeScore: number }).homeScore).toBe(1);
  });
  it("preserves legacy scores and can attach names without double-counting goals", () => {
    let c = setup();
    c = command(c, { type: "match_status", status: "live" });
    c = command(c, { type: "score", homeScore: 2, awayScore: 1 });
    c = goal(c);
    expect(c.matches[0].homeScore).toBe(3);
    expect(c.matches[0].goalBaseline).toEqual({ home: 2, away: 1 });
    c = goal(c, { existing: true });
    expect(c.matches[0].homeScore).toBe(3);
    expect(c.matches[0].goalBaseline?.home).toBe(1);
    expect(() =>
      command(c, { type: "score", homeScore: 99, awayScore: 0 }),
    ).toThrow("catatan gol");
    c = final(c);
    expect(
      playerStatistics(c).find((p) => p.name === "Andi Saputra")?.goals,
    ).toBe(2);
  });
  it("rejects duplicates from retries, stale edits, invalid team, self assist, oversized names and locked competitions", () => {
    const old = setup();
    const c = goal(old);
    expect(() =>
      applyCommand(c, operator, {
        type: "goal_add",
        version: old.version,
        matchId: c.matches[0].id,
        matchVersion: old.matches[0].version,
        teamId: c.matches[0].home,
        scorerName: "Andi",
      }),
    ).toThrow("diperbarui");
    expect(() => goal(c, { teamId: "other-team" })).toThrow("tim pertandingan");
    expect(() => goal(c, { assistName: "  ANDI SAPUTRA " })).toThrow(
      "harus berbeda",
    );
    expect(() => goal(c, { scorerName: "x".repeat(81) })).toThrow();
    expect(() => goal(c, { scorerName: "   " })).toThrow();
    expect(() => goal(c, { minute: -1 })).toThrow();
    expect(() =>
      command(
        c,
        { type: "goal_add", teamId: c.matches[0].home, scorerName: "Andi" },
        stranger,
      ),
    ).toThrow("akses");
    const closed = { ...c, status: "archived" as const };
    expect(() => goal(closed)).toThrow("ditutup");
  });
  it("propagates corrected knockout winners and protects downstream matches already started", () => {
    let c = setup("knockout");
    c = goal(c, { assistName: "" });
    c = final(c);
    const g = c.matches[0].goals![0];
    const home = c.matches[0].home;
    const away = c.matches[0].away;
    c = command(c, {
      type: "goal_update",
      goalId: g.id,
      teamId: home,
      scorerName: "Andi Saputra",
      ownGoal: true,
      confirm: true,
      reason: "Wasit menetapkan gol bunuh diri",
    });
    expect(c.matches[0].winner).toBe(away);
    const downstream = c.matches.find((m) => m.sourceHome === c.matches[0].id)!;
    expect(downstream.home).toBe(away);
    downstream.status = "live";
    expect(() =>
      command(c, {
        type: "goal_update",
        goalId: g.id,
        teamId: home,
        scorerName: "Andi Saputra",
        ownGoal: false,
        confirm: true,
        reason: "Wasit membetulkan pencetak gol",
      }),
    ).toThrow("babak berikutnya");
  });
});
