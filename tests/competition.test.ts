import { describe, it, expect } from "vitest";
import {
  applyCommand,
  createCompetition,
  standings,
  restWarnings,
  prioritizeRest,
  canView,
  roleFor,
  playerStatistics,
} from "../src/lib/competition";
const owner = { id: crypto.randomUUID(), email: "owner@example.test" };
const operator = { id: crypto.randomUUID(), email: "operator@example.test" };
const stranger = { id: crypto.randomUUID(), email: "stranger@example.test" };
function competition(overrides: Record<string, unknown> = {}) {
  return createCompetition(
    {
      name: "Kompetisi pengujian",
      format: "fourfeo",
      teamNames: ["Garuda", "Elang", "Rajawali", "Singa"],
      ...overrides,
    },
    owner,
  );
}
function cmd(
  c: ReturnType<typeof competition>,
  command: Record<string, unknown>,
  user = owner,
) {
  return applyCommand(c, user, { ...command, version: c.version });
}
function publish(c = competition()) {
  return cmd(c, { type: "publish" });
}
function finalize(
  c: ReturnType<typeof competition>,
  id = c.matches[0].id,
  homeScore = 2,
  awayScore = 1,
) {
  return cmd(c, {
    type: "finalize",
    matchId: id,
    matchVersion: c.matches.find((m) => m.id === id)!.version,
    homeScore,
    awayScore,
    confirm: true,
  });
}
describe("Fixture generation", () => {
  it.each([
    [1, 6],
    [2, 12],
    [3, 18],
    [5, 30],
  ])("fourfeo %i meetings generates %i fixtures", (meetings, count) => {
    const c = competition({ meetings });
    expect(c.matches).toHaveLength(count);
    for (const t of c.teams)
      expect(
        c.matches.filter((m) => m.home === t.id || m.away === t.id),
      ).toHaveLength(3 * meetings);
    const pairs = c.matches.map((m) =>
      [...[m.home!, m.away!].sort(), m.meeting].join(":"),
    );
    expect(new Set(pairs).size).toBe(count);
    expect(c.matches.every((m) => m.home !== m.away)).toBe(true);
    expect(new Set(c.matches.map((m) => m.id)).size).toBe(count);
  });
  it("alternates sides between meetings", () => {
    const c = competition();
    for (const m of c.matches.filter((m) => m.meeting === 1)) {
      const returnMatch = c.matches.find(
        (x) => x.meeting === 2 && x.home === m.away && x.away === m.home,
      );
      expect(returnMatch).toBeDefined();
    }
  });
  it("handles odd team counts in league", () => {
    const c = competition({
      format: "league",
      teamNames: ["A", "B", "C", "D", "E"],
      meetings: 2,
    });
    expect(c.matches).toHaveLength(20);
    expect(c.matches.every((m) => m.home && m.away)).toBe(true);
  });
  it("only matches teams within their own group, including uneven groups", () => {
    const c = competition({
      format: "group_stage",
      teamNames: ["A", "B", "C", "D", "E"],
      groups: 2,
      meetings: 1,
    });
    expect(c.matches).toHaveLength(4);
    for (const m of c.matches)
      expect(c.teams.find((t) => t.id === m.home)!.group).toBe(
        c.teams.find((t) => t.id === m.away)!.group,
      );
  });
  it.each([2, 3, 5, 6, 7, 9])(
    "knockout of %i has n-1 actual matches with valid byes",
    (n) => {
      const c = competition({
        format: "knockout",
        teamNames: Array.from({ length: n }, (_, i) => `Team ${i}`),
      });
      expect(c.matches).toHaveLength(n - 1);
      expect(
        c.matches
          .filter((m) => !m.sourceHome && !m.sourceAway)
          .every((m) => m.home && m.away),
      ).toBe(true);
    },
  );
  it("detects adjacent-team rest warnings", () => {
    const c = competition();
    const matches = [
      c.matches[0],
      { ...c.matches[1], home: c.matches[0].home },
    ];
    expect(restWarnings(matches).has(matches[1].id)).toBe(true);
  });
  it("reorders stable fixture identities without touching pairs or scores", () => {
    const c = competition();
    const ids = c.matches.map((m) => m.id).reverse();
    const out = cmd(c, { type: "reorder", ids });
    expect(out.matches.map((m) => m.id)).toEqual(ids);
    for (const m of out.matches) {
      const old = c.matches.find((x) => x.id === m.id)!;
      expect([m.home, m.away, m.homeScore, m.awayScore]).toEqual([
        old.home,
        old.away,
        old.homeScore,
        old.awayScore,
      ]);
    }
  });
  it("anchors final and live fixtures", () => {
    const c = finalize(publish());
    expect(() =>
      cmd(c, { type: "reorder", ids: c.matches.map((m) => m.id).reverse() }),
    ).toThrow("posisinya");
  });
  it("rejects duplicate names, wrong fourfeo size and invalid group settings", () => {
    expect(() => competition({ teamNames: ["A", "a", "C", "D"] })).toThrow();
    expect(() => competition({ teamNames: ["A", "B", "C"] })).toThrow();
    expect(() => competition({ format: "group_stage", groups: 3 })).toThrow();
  });
});
describe("Scoring and official standings", () => {
  it("live scores update provisional standings and final-only standings stay unchanged", () => {
    let c = publish();
    expect(standings(c).every((r) => !r.played && !r.points)).toBe(true);
    c = cmd(c, {
      type: "match_status",
      matchId: c.matches[0].id,
      matchVersion: 0,
      status: "live",
    });
    c = cmd(c, {
      type: "score",
      matchId: c.matches[0].id,
      matchVersion: 1,
      homeScore: 8,
      awayScore: 3,
    });
    expect(
      standings(c).find((r) => r.team.id === c.matches[0].home),
    ).toMatchObject({ played: 1, points: 3, gf: 8, ga: 3, gd: 5 });
    expect(
      standings(c, undefined, false).every((r) => !r.played && !r.points),
    ).toBe(true);
  });
  it("confirms final and recalculates after audited correction", () => {
    let c = finalize(publish());
    const m = c.matches[0];
    let rows = standings(c);
    expect(rows.find((r) => r.team.id === m.home)).toMatchObject({
      points: 3,
      played: 1,
      gd: 1,
    });
    expect(rows.find((r) => r.team.id === m.away)).toMatchObject({
      points: 0,
      played: 1,
      gd: -1,
    });
    c = cmd(c, {
      type: "correct",
      matchId: m.id,
      matchVersion: m.version,
      homeScore: 1,
      awayScore: 1,
      reason: "Kesalahan pencatatan",
      confirm: true,
    });
    rows = standings(c);
    expect(
      rows
        .filter((r) => r.team.id === m.home || r.team.id === m.away)
        .every((r) => r.points === 1 && r.gd === 0),
    ).toBe(true);
    expect(c.audit.at(-1)).toMatchObject({
      event: "correct",
      reason: "Kesalahan pencatatan",
      actor: owner.email,
    });
  });
  it("aggregates both meetings", () => {
    let c = publish();
    for (const m of c.matches) c = finalize(c, m.id, 0, 0);
    expect(standings(c).every((r) => r.played === 6 && r.points === 6)).toBe(
      true,
    );
  });
  it("ignores cancelled/postponed matches", () => {
    let c = publish();
    c = cmd(c, {
      type: "match_status",
      matchId: c.matches[0].id,
      matchVersion: 0,
      status: "postponed",
    });
    c = cmd(c, {
      type: "match_status",
      matchId: c.matches[1].id,
      matchVersion: 0,
      status: "cancelled",
    });
    expect(standings(c).every((r) => !r.played)).toBe(true);
  });
  it("requires confirmation and nonnegative integer scores", () => {
    const c = publish();
    const m = c.matches[0];
    expect(() =>
      cmd(c, {
        type: "finalize",
        matchId: m.id,
        matchVersion: 0,
        homeScore: 2,
        awayScore: 1,
      }),
    ).toThrow("konfirmasi");
    for (const homeScore of [-1, 1.5])
      expect(() => finalize(c, m.id, homeScore)).toThrow();
  });
  it("deduplicates repeated final confirmations", () => {
    const c = finalize(publish());
    const m = c.matches[0];
    const repeated = cmd(c, {
      type: "finalize",
      matchId: m.id,
      matchVersion: 0,
      homeScore: 2,
      awayScore: 1,
      confirm: true,
    });
    expect(repeated).toEqual(c);
  });
  it("marks unresolved ties and records manual tie resolution", () => {
    let c = competition();
    expect(standings(c).every((r) => r.tied)).toBe(true);
    c = cmd(c, {
      type: "resolve_tie",
      ids: c.teams.map((t) => t.id),
      reason: "Undian bersama panitia",
    });
    expect(standings(c).every((r) => !r.tied)).toBe(true);
  });
  it("uses head-to-head mini tables for otherwise equal rankings", () => {
    const c = publish(
      competition({
        format: "league",
        teamNames: ["A", "B", "C"],
        meetings: 1,
      }),
    );
    let out = c;
    for (const m of out.matches) {
      const hn = out.teams.find((t) => t.id === m.home)!.name;
      const an = out.teams.find((t) => t.id === m.away)!.name;
      const wins =
        (hn === "A" && an === "B") ||
        (hn === "B" && an === "C") ||
        (hn === "C" && an === "A");
      out = finalize(out, m.id, wins ? 1 : 0, wins ? 0 : 1);
    }
    expect(standings(out).every((r) => r.tied)).toBe(true);
  });
});
describe("Bracket progression and safeguards", () => {
  it("requires a winner in knockout ties", () => {
    const c = publish(competition({ format: "knockout" }));
    expect(() => finalize(c, c.matches[0].id, 1, 1)).toThrow("penalti");
  });
  it("advances a penalty winner atomically", () => {
    const c = publish(competition({ format: "knockout" }));
    const m = c.matches[0];
    const out = cmd(c, {
      type: "finalize",
      matchId: m.id,
      matchVersion: 0,
      homeScore: 1,
      awayScore: 1,
      homePenalty: 4,
      awayPenalty: 3,
      confirm: true,
    });
    expect(out.matches[0].winner).toBe(m.home);
    const downstream = out.matches.find((x) => x.sourceHome === m.id)!;
    expect(downstream.home).toBe(m.home);
  });
  it("protects a started downstream match from winner-changing correction", () => {
    let c = publish(competition({ format: "knockout" }));
    c = finalize(c, c.matches[0].id);
    c = finalize(c, c.matches[1].id);
    const final = c.matches.find((m) => m.round === 2)!;
    c = cmd(c, {
      type: "match_status",
      matchId: final.id,
      matchVersion: final.version,
      status: "live",
    });
    const feeder = c.matches[0];
    expect(() =>
      cmd(c, {
        type: "correct",
        matchId: feeder.id,
        matchVersion: feeder.version,
        homeScore: 0,
        awayScore: 3,
        reason: "Salah peserta menang",
        confirm: true,
      }),
    ).toThrow("babak berikutnya");
  });
  it("finishes a non-power-of-two bracket without phantom games", () => {
    let c = publish(
      competition({ format: "knockout", teamNames: ["A", "B", "C", "D", "E"] }),
    );
    while (c.matches.some((m) => m.status !== "final")) {
      const m = c.matches.find(
        (m) => m.status === "scheduled" && m.home && m.away,
      )!;
      expect(m).toBeDefined();
      c = finalize(c, m.id);
    }
    expect(c.matches).toHaveLength(4);
    expect(c.matches.at(-1)?.winner).toBeTruthy();
  });
  it("freezes group qualification only after all results, and refuses unresolved ties", () => {
    let c = publish(
      competition({
        format: "group_then_knockout",
        qualifiers: 1,
        meetings: 1,
      }),
    );
    expect(() => cmd(c, { type: "qualify" })).toThrow("Selesaikan");
    for (const m of c.matches) c = finalize(c, m.id, 0, 0);
    expect(() => cmd(c, { type: "qualify" })).toThrow("seri");
    c = cmd(c, {
      type: "resolve_tie",
      ids: c.teams.map((t) => t.id),
      reason: "Undian resmi",
    });
    c = cmd(c, { type: "qualify" });
    expect(c.matches.filter((m) => m.stage === "knockout")).toHaveLength(1);
    expect(() => cmd(c, { type: "qualify" })).toThrow("ulang");
  });
});
describe("Visibility, permissions and optimistic locking", () => {
  it("public drafts stay private and unlisted has direct-link access", () => {
    const c = competition();
    expect(canView(c)).toBe(false);
    expect(canView(c, owner.id)).toBe(true);
    expect(canView(publish(c))).toBe(true);
    expect(canView(publish(competition({ visibility: "unlisted" })))).toBe(
      true,
    );
    expect(
      canView(publish(competition({ visibility: "private" })), stranger.id),
    ).toBe(false);
  });
  it("rejects unauthorized writes and cross-competition match IDs", () => {
    const c = publish();
    expect(() => cmd(c, { type: "publish" }, stranger)).toThrow("akses");
    expect(() =>
      cmd(c, {
        type: "finalize",
        matchId: competition().matches[0].id,
        matchVersion: 0,
        homeScore: 2,
        awayScore: 1,
        confirm: true,
      }),
    ).toThrow("tidak ditemukan");
  });
  it("score operators cannot edit rules, teams, visibility or members", () => {
    const c = publish();
    c.members.push({
      userId: operator.id,
      email: operator.email,
      role: "score_operator",
    });
    for (const type of [
      "teams",
      "settings",
      "reorder",
      "resolve_tie",
      "revoke",
    ])
      expect(() => cmd(c, { type }, operator)).toThrow("owner atau admin");
    expect(() =>
      cmd(
        c,
        {
          type: "match_status",
          matchId: c.matches[0].id,
          matchVersion: 0,
          status: "live",
        },
        operator,
      ),
    ).not.toThrow();
  });
  it("detects stale competition and match versions", () => {
    const c = publish();
    expect(() =>
      applyCommand(c, owner, { type: "publish", version: c.version - 1 }),
    ).toThrow("diperbarui");
    expect(() =>
      cmd(c, {
        type: "match_status",
        matchId: c.matches[0].id,
        matchVersion: 6,
        status: "live",
      }),
    ).toThrow("berubah");
  });
  it("cannot remove the last owner and revocation takes effect immediately", () => {
    let c = publish();
    expect(() => cmd(c, { type: "revoke", userId: owner.id })).toThrow(
      "Owner terakhir",
    );
    c.members.push({
      userId: operator.id,
      email: operator.email,
      role: "score_operator",
    });
    c = cmd(c, { type: "revoke", userId: operator.id });
    expect(roleFor(c, operator.id)).toBeUndefined();
    expect(() => cmd(c, { type: "match_status" }, operator)).toThrow("akses");
  });
});

describe("Ranking edge cases and draft stability", () => {
  it("distinguishes separate unresolved head-to-head subgroups", () => {
    let c = publish(
      competition({
        format: "league",
        teamNames: ["A", "B", "C", "D", "E", "F"],
        meetings: 1,
      }),
    );
    for (const m of c.matches) {
      const a = c.teams.find((t) => t.id === m.home)!.name,
        b = c.teams.find((t) => t.id === m.away)!.name;
      let h = 0,
        away = 0;
      const pair = [a, b].sort().join("");
      if (["AB", "CD"].includes(pair)) {
        h = 1;
        away = 1;
      } else if (pair === "EF") {
        h = 0;
        away = 0;
      } else {
        const aWins =
          (["A", "B"].includes(a) && ["C", "D"].includes(b)) ||
          (["C", "D"].includes(a) && ["E", "F"].includes(b)) ||
          (["E", "F"].includes(a) && ["A", "B"].includes(b));
        h = aWins ? 1 : 0;
        away = aWins ? 0 : 1;
      }
      c = finalize(c, m.id, h, away);
    }
    const ranks = standings(c);
    expect(ranks.map((r) => r.position)).toEqual([1, 1, 3, 3, 5, 5]);
    expect(ranks.every((r) => r.tied)).toBe(true);
  });
  it("renaming grouped teams preserves stable fixture IDs", () => {
    const c = competition({ format: "group_stage" });
    const out = cmd(c, {
      type: "teams",
      teams: c.teams.map((t) => ({
        id: t.id,
        name: t.name + " FC",
        group: t.group,
      })),
    });
    expect(out.matches.map((m) => m.id)).toEqual(c.matches.map((m) => m.id));
  });
  it("renames a LIVE team without changing goals, players, fixtures or tie ordering", () => {
    let c = publish(competition({ format: "group_stage" }));
    const match = c.matches[0];
    c = cmd(c, {
      type: "goal_add",
      matchId: match.id,
      matchVersion: match.version,
      teamId: match.home,
      scorerName: "Andi",
      assistName: "Budi",
    });
    c.tieOrder = c.teams.map((t) => t.id);
    const renamed = c.teams.find((t) => t.id === match.home)!;
    const out = cmd(c, {
      type: "teams",
      teams: c.teams.map((t) => ({
        ...t,
        name: t.id === renamed.id ? "  Nama baru FC  " : t.name,
      })),
    });
    expect(out.teams.find((t) => t.id === renamed.id)).toEqual({
      ...renamed,
      name: "Nama baru FC",
    });
    expect(out.matches).toEqual(c.matches);
    expect(out.players).toEqual(c.players);
    expect(out.tieOrder).toEqual(c.tieOrder);
    expect(out.status).toBe("in_progress");
    expect(
      standings(out, renamed.group!).find((r) => r.team.id === renamed.id)?.team
        .name,
    ).toBe("Nama baru FC");
    expect(playerStatistics(out)).toEqual(playerStatistics(c));
    expect(out.audit.at(-1)).toMatchObject({
      event: "teams",
      before: c.teams,
      after: out.teams,
    });
    expect(c.teams.find((t) => t.id === renamed.id)?.name).toBe(renamed.name);
  });
  it("keeps published participant IDs and groups locked even with regeneration confirmation", () => {
    const c = publish(competition({ format: "group_stage" }));
    const teams = c.teams.map((t) => ({ ...t }));
    const swapped = teams.map((t) => ({
      ...t,
      group: t.group === "A" ? "B" : "A",
    }));
    const replaced = teams.map((t, i) =>
      i === 0 ? { ...t, id: "new-replacement" } : t,
    );
    const added = [...teams, { ...teams[0], id: "new-extra", name: "Extra" }];
    for (const submitted of [swapped, replaced, added, teams.slice(1)]) {
      expect(() =>
        cmd(c, { type: "teams", teams: submitted, confirm: true }),
      ).toThrow();
    }
    expect(c.matches.every((m) => m.homeScore === 0 && m.awayScore === 0)).toBe(
      true,
    );
  });
  it("rejects duplicate/empty names and stale renames after publication", () => {
    const c = publish();
    for (const name of [
      "",
      " ",
      c.teams[1].name.toUpperCase(),
      "x".repeat(61),
    ]) {
      expect(() =>
        cmd(c, {
          type: "teams",
          teams: c.teams.map((t, i) => ({
            ...t,
            name: i === 0 ? name : t.name,
          })),
        }),
      ).toThrow();
    }
    expect(() =>
      applyCommand(c, owner, {
        type: "teams",
        teams: c.teams,
        version: c.version - 1,
      }),
    ).toThrow();
  });
});

describe("Draft regeneration, settings and ownership", () => {
  it("allows adding/removing league teams with confirmation and stable retained team IDs", () => {
    const c = competition({ format: "league" });
    const submitted = c.teams
      .slice(0, 3)
      .map((t) => ({ id: t.id, name: t.name, group: t.group }));
    submitted.push({ id: "new-team", name: "Baru", group: null });
    expect(() => cmd(c, { type: "teams", teams: submitted })).toThrow(
      "konfirmasi",
    );
    const out = cmd(c, { type: "teams", teams: submitted, confirm: true });
    expect(out.teams.slice(0, 3).map((t) => t.id)).toEqual(
      c.teams.slice(0, 3).map((t) => t.id),
    );
    expect(out.teams[3].id).not.toBe("new-team");
    expect(
      out.matches.every(
        (m) =>
          out.teams.some((t) => t.id === m.home) &&
          out.teams.some((t) => t.id === m.away),
      ),
    ).toBe(true);
  });
  it("validates subgroup qualification against actual uneven group sizes", () => {
    const c = competition({
      format: "group_then_knockout",
      teamNames: ["A", "B", "C", "D", "E", "F"],
      qualifiers: 3,
    });
    const teams = c.teams.map((t, i) => ({
      id: t.id,
      name: t.name,
      group: i < 4 ? "A" : "B",
    }));
    expect(() => cmd(c, { type: "teams", teams, confirm: true })).toThrow(
      "Alokasi",
    );
  });
  it("changes rules only in draft with an explicit schedule regeneration confirmation", () => {
    const c = competition();
    expect(() =>
      cmd(c, { type: "rules", rules: { ...c.rules, meetings: 3 } }),
    ).toThrow("konfirmasi");
    const out = cmd(c, {
      type: "rules",
      rules: { ...c.rules, meetings: 3, win: 5 },
      confirm: true,
    });
    expect(out.matches).toHaveLength(18);
    expect(out.rules.win).toBe(5);
    expect(out.teams).toEqual(c.teams);
    expect(out.audit.at(-1)?.event).toBe("rules");
    expect(() =>
      cmd(publish(out), { type: "rules", rules: c.rules, confirm: true }),
    ).toThrow("terkunci");
  });
  it("owner alone can transfer and remains admin; exactly one owner survives", () => {
    let c = competition();
    c.members.push({
      userId: operator.id,
      email: operator.email,
      role: "admin",
    });
    expect(() =>
      cmd(c, { type: "transfer", userId: owner.id, confirm: true }, operator),
    ).toThrow("Hanya owner");
    c = cmd(c, { type: "transfer", userId: operator.id, confirm: true });
    expect(c.ownerId).toBe(operator.id);
    expect(roleFor(c, owner.id)).toBe("admin");
    expect(c.members.filter((m) => m.role === "owner")).toHaveLength(1);
  });
});

it("rest optimization preserves IDs, results and anchored positions", () => {
  const c = finalize(publish());
  const optimized = prioritizeRest(c.matches);
  expect(new Set(optimized.map((m) => m.id))).toEqual(
    new Set(c.matches.map((m) => m.id)),
  );
  expect(optimized[0]).toEqual(c.matches[0]);
  for (const m of optimized)
    expect({ ...m, order: 0 }).toEqual({
      ...c.matches.find((old) => old.id === m.id),
      order: 0,
    });
});
