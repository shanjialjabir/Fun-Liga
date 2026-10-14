import { describe, it, expect } from "vitest";
import {
  createCompetition,
  applyCommand,
  drawGroups,
  drawBracketSlots,
  validateBracketSlots,
  knockout,
  qualifiedTeams,
  canDrawKnockout,
  bracketSize,
  type Team,
} from "../src/lib/competition";
const owner = { id: crypto.randomUUID(), email: "drawing-owner@example.test" };
const operator = {
  id: crypto.randomUUID(),
  email: "drawing-operator@example.test",
};
function create(groups = 2, qualifiers = 2) {
  return createCompetition(
    {
      name: "Drawing tournament",
      format: "group_then_knockout",
      groups,
      qualifiers,
      meetings: 1,
      teamNames: Array.from(
        { length: Math.max(3, qualifiers) * groups },
        (_, i) => `Team ${i}`,
      ),
      thirdPlace: true,
    },
    owner,
  );
}
function completed(groups = 2, qualifiers = 2) {
  let c = create(groups, qualifiers);
  c = applyCommand(c, owner, { type: "publish", version: c.version });
  for (const m of c.matches)
    c = applyCommand(c, owner, {
      type: "finalize",
      version: c.version,
      matchId: m.id,
      matchVersion: m.version,
      homeScore: 0,
      awayScore: 0,
      confirm: true,
    });
  return applyCommand(c, owner, {
    type: "resolve_tie",
    version: c.version,
    ids: c.teams.map((t) => t.id),
    reason: "Hasil drawing resmi panitia",
  });
}
function teams(count: number, groups = 0): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `T ${i}`,
    group: groups ? String.fromCharCode(65 + (i % groups)) : null,
    color: "#ADEC25",
  }));
}
describe("Group and knockout real-world drawing", () => {
  it("random group assignment retains identities and balances uneven group sizes", () => {
    const c = create(4);
    const drawn = drawGroups(c.teams, 4, () => 0);
    expect(drawn.map((t) => t.id)).toEqual(c.teams.map((t) => t.id));
    expect(
      drawn.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    ).toEqual(c.teams.map((t) => ({ id: t.id, name: t.name, color: t.color })));
    expect(
      ["A", "B", "C", "D"].map(
        (g) => drawn.filter((t) => t.group === g).length,
      ),
    ).toEqual([3, 3, 3, 3]);
    const odd = drawGroups(teams(11), 4, () => 0);
    expect(
      ["A", "B", "C", "D"].map((g) => odd.filter((t) => t.group === g).length),
    ).toEqual([3, 3, 3, 2]);
  });
  it("applies a manual group drawing and regenerates only draft fixtures with fair group turns", () => {
    const c = create(4);
    const assignments = c.teams.map((t) => ({
      id: t.id,
      group: String.fromCharCode(65 + ((t.group!.charCodeAt(0) - 65 + 1) % 4)),
    }));
    const result = applyCommand(c, owner, {
      type: "group_draw",
      version: c.version,
      assignments,
      confirm: true,
    });
    expect(result.teams.map((t) => t.id)).toEqual(c.teams.map((t) => t.id));
    expect(result.teams.map((t) => t.group)).toEqual(
      assignments.map((t) => t.group),
    );
    expect(result.matches.slice(0, 8).map((m) => m.group)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(
      result.matches.every(
        (m) =>
          result.teams.find((t) => t.id === m.home)?.group ===
          result.teams.find((t) => t.id === m.away)?.group,
      ),
    ).toBe(true);
    expect(result.audit.at(-1)?.event).toBe("group_draw");
    expect(c.version).toBe(0);
  });
  it("rejects group drawing after publication, malformed assignments, undersized groups, missing confirmation, unauthorized or stale requests", () => {
    const c = create();
    const assignments = c.teams.map((t) => ({ id: t.id, group: t.group }));
    const command = {
      type: "group_draw",
      version: c.version,
      assignments,
      confirm: true,
    };
    expect(() =>
      applyCommand(c, owner, { ...command, confirm: false }),
    ).toThrow("Konfirmasikan");
    expect(() =>
      applyCommand(c, owner, { ...command, assignments: assignments.slice(1) }),
    ).toThrow("tidak valid");
    expect(() =>
      applyCommand(c, owner, {
        ...command,
        assignments: assignments.map((t) => ({ ...t, group: "A" })),
      }),
    ).toThrow("minimal");
    c.members.push({
      userId: operator.id,
      email: operator.email,
      role: "score_operator",
    });
    expect(() => applyCommand(c, operator, command)).toThrow(
      "owner atau admin",
    );
    expect(() => applyCommand(c, owner, { ...command, version: 99 })).toThrow(
      "diperbarui",
    );
    c.status = "published";
    expect(() => applyCommand(c, owner, command)).toThrow("draft");
  });
  it.each([2, 3, 5, 6, 7, 9, 15, 17, 31, 32])(
    "draws %i knockout entrants once with valid byes and linked advancement",
    (count) => {
      const entrants = teams(count);
      const slots = drawBracketSlots(entrants, false, () => 0);
      expect(slots).toHaveLength(bracketSize(count));
      expect(slots.filter(Boolean)).toHaveLength(count);
      expect(new Set(slots.filter(Boolean))).toEqual(
        new Set(entrants.map((t) => t.id)),
      );
      expect(() => validateBracketSlots(entrants, slots, false)).not.toThrow();
      const matches = knockout(entrants, false, slots);
      expect(matches).toHaveLength(count - 1);
      for (const [index, m] of matches.entries())
        for (const source of [m.sourceHome, m.sourceAway])
          if (source)
            expect(matches.slice(0, index).some((x) => x.id === source)).toBe(
              true,
            );
    },
  );
  it.each([
    [2, 3],
    [3, 2],
    [3, 3],
    [5, 2],
    [7, 3],
    [8, 4],
  ])(
    "draws %i groups with %i qualifiers avoiding same-group opening ties, including byes",
    (groups, qualifiers) => {
      const entrants = teams(groups * qualifiers, groups);
      for (let seed = 1; seed <= 15; seed++) {
        let state = seed;
        const slots = drawBracketSlots(entrants, true, (max) => {
          state = (state * 1664525 + 1013904223) >>> 0;
          return state % max;
        });
        expect(() => validateBracketSlots(entrants, slots, true)).not.toThrow();
        expect(knockout(entrants, false, slots)).toHaveLength(
          entrants.length - 1,
        );
      }
    },
  );
  it("accepts free manual drawings and rejects same-group pairs under the restricted option", () => {
    const entrants = teams(4, 2);
    const slots = [
      entrants[0].id,
      entrants[2].id,
      entrants[1].id,
      entrants[3].id,
    ];
    expect(() => validateBracketSlots(entrants, slots, false)).not.toThrow();
    expect(() => validateBracketSlots(entrants, slots, true)).toThrow(
      "grup yang sama",
    );
    expect(() => drawBracketSlots(teams(4, 1), true, () => 0)).toThrow(
      "tidak memungkinkan",
    );
    expect(() =>
      validateBracketSlots(entrants, [slots[0], slots[0], slots[2], slots[3]]),
    ).toThrow("tepat satu kali");
    const six = teams(6);
    expect(() =>
      validateBracketSlots(six, [null, null, ...six.map((t) => t.id)]),
    ).toThrow("Dua bye");
  });
  it("qualifies only eligible teams, previews without mutation and creates a manual bracket preserving final group results", () => {
    const c = completed(3, 2);
    const groupBefore = structuredClone(c.matches);
    const qualified = qualifiedTeams(c);
    expect(qualified).toHaveLength(6);
    const slots = drawBracketSlots(qualified, true, () => 0);
    const proposed = knockout(qualified, true, slots);
    expect(c.matches).toEqual(groupBefore);
    const result = applyCommand(c, owner, {
      type: "knockout_draw",
      version: c.version,
      slots,
      avoidSameGroup: true,
      confirm: true,
    });
    expect(result.matches.filter((m) => m.stage === "group")).toEqual(
      groupBefore,
    );
    expect(result.matches.filter((m) => m.stage === "knockout")).toHaveLength(
      proposed.length,
    );
    expect(result.knockoutDrawing).toEqual({ slots, avoidSameGroup: true });
    expect(result.audit.at(-1)?.event).toBe("knockout_draw");
    expect(
      result.matches.filter((m) => m.sourceOutcome === "loser"),
    ).toHaveLength(1);
  });
  it("allows redrawing an unplayed bracket, preserves time slots and protects played or closed brackets", () => {
    let c = completed();
    let slots = drawBracketSlots(qualifiedTeams(c), true, () => 0);
    c = applyCommand(c, owner, {
      type: "knockout_draw",
      version: c.version,
      slots,
      avoidSameGroup: true,
      confirm: true,
    });
    const m = c.matches.find((m) => m.stage === "knockout")!;
    c = applyCommand(c, owner, {
      type: "schedule",
      version: c.version,
      matchId: m.id,
      matchVersion: m.version,
      scheduledAt: "2026-10-16T10:00:00.000Z",
    });
    const before = c.matches
      .filter((m) => m.stage === "knockout")
      .map((m) => m.scheduledAt);
    slots = slots.slice(2).concat(slots.slice(0, 2));
    c = applyCommand(c, owner, {
      type: "knockout_draw",
      version: c.version,
      slots,
      avoidSameGroup: true,
      confirm: true,
    });
    expect(
      c.matches.filter((m) => m.stage === "knockout").map((m) => m.scheduledAt),
    ).toEqual(before);
    const first = c.matches.find((m) => m.stage === "knockout")!;
    c = applyCommand(c, owner, {
      type: "match_status",
      version: c.version,
      matchId: first.id,
      matchVersion: first.version,
      status: "live",
    });
    expect(canDrawKnockout(c)).toBe(false);
    c = applyCommand(c, owner, {
      type: "match_status",
      version: c.version,
      matchId: first.id,
      matchVersion: c.matches.find((m) => m.id === first.id)!.version,
      status: "postponed",
    });
    expect(canDrawKnockout(c)).toBe(false);
    expect(() =>
      applyCommand(c, owner, {
        type: "knockout_draw",
        version: c.version,
        slots,
        confirm: true,
      }),
    ).toThrow("Bagan terkunci");
    const closed = completed();
    closed.status = "archived";
    expect(() =>
      applyCommand(closed, owner, {
        type: "knockout_draw",
        version: closed.version,
        slots,
        confirm: true,
      }),
    ).toThrow("Bagan terkunci");
  });
  it("rejects premature qualification, unresolved ties, non-qualifiers and score operators", () => {
    const c = create();
    expect(() => qualifiedTeams(c)).toThrow("Selesaikan");
    const final = completed();
    final.tieOrder = [];
    expect(() => qualifiedTeams(final)).toThrow("seri");
    const ready = completed();
    const slots = drawBracketSlots(qualifiedTeams(ready), true, () => 0);
    const notQualified = ready.teams.find((t) => !slots.includes(t.id))!;
    const invalid = [...slots];
    invalid[0] = notQualified.id;
    expect(() =>
      applyCommand(ready, owner, {
        type: "knockout_draw",
        version: ready.version,
        slots: invalid,
        confirm: true,
      }),
    ).toThrow("tim lolos");
    ready.members.push({
      userId: operator.id,
      email: operator.email,
      role: "score_operator",
    });
    expect(() =>
      applyCommand(ready, operator, {
        type: "knockout_draw",
        version: ready.version,
        slots,
        confirm: true,
      }),
    ).toThrow("owner atau admin");
  });
  it("advances winners and semifinal losers through a manually drawn bracket", () => {
    let c = completed();
    const slots = drawBracketSlots(qualifiedTeams(c), true, () => 0);
    c = applyCommand(c, owner, {
      type: "knockout_draw",
      version: c.version,
      slots,
      avoidSameGroup: true,
      confirm: true,
    });
    const semis = c.matches.filter(
      (m) => m.stage === "knockout" && m.round === 1,
    );
    for (const m of semis)
      c = applyCommand(c, owner, {
        type: "finalize",
        version: c.version,
        matchId: m.id,
        matchVersion: m.version,
        homeScore: 2,
        awayScore: 1,
        confirm: true,
      });
    const final = c.matches.find(
      (m) =>
        m.stage === "knockout" && m.round === 2 && m.sourceOutcome !== "loser",
    )!;
    const bronze = c.matches.find((m) => m.sourceOutcome === "loser")!;
    expect([final.home, final.away]).toEqual(semis.map((m) => m.home));
    expect([bronze.home, bronze.away]).toEqual(semis.map((m) => m.away));
  });
});
