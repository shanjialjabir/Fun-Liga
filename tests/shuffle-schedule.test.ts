import { describe, expect, it } from "vitest";
import {
  createCompetition,
  applyCommand,
  shuffleSchedule,
  canShuffleSchedule,
} from "../src/lib/competition";
const owner = { id: crypto.randomUUID(), email: "shuffle-owner@example.test" };
const operator = {
  id: crypto.randomUUID(),
  email: "shuffle-operator@example.test",
};
function create(format: "group_stage" | "league" | "knockout" = "group_stage") {
  return createCompetition(
    {
      name: "Shuffle test",
      format,
      groups: 4,
      meetings: 2,
      teamNames: Array.from(
        { length: format === "group_stage" ? 16 : 8 },
        (_, i) => `Team ${i + 1}`,
      ),
    },
    owner,
  );
}
describe("Drawing within original rounds and group slots", () => {
  for (const format of ["group_stage", "league", "knockout"] as const) {
    it(`shuffles ${format} without crossing group/round/meeting or changing match identity`, () => {
      const c = create(format);
      const before = structuredClone(c.matches);
      const proposed = shuffleSchedule(c.matches, () => 0);
      expect(canShuffleSchedule(c.matches)).toBe(true);
      expect(proposed.some((m, i) => m.id !== before[i].id)).toBe(true);
      expect(
        proposed.map((m) => [m.group, m.round, m.meeting, m.stage]),
      ).toEqual(before.map((m) => [m.group, m.round, m.meeting, m.stage]));
      expect(new Set(proposed.map((m) => m.id))).toEqual(
        new Set(before.map((m) => m.id)),
      );
      for (const m of proposed) {
        const original = before.find((x) => x.id === m.id)!;
        expect([
          m.home,
          m.away,
          m.homeScore,
          m.awayScore,
          m.sourceHome,
          m.sourceAway,
        ]).toEqual([
          original.home,
          original.away,
          original.homeScore,
          original.awayScore,
          original.sourceHome,
          original.sourceAway,
        ]);
      }
      expect(c.matches).toEqual(before);
      const applied = applyCommand(c, owner, {
        type: "shuffle_schedule",
        version: c.version,
        ids: proposed.map((m) => m.id),
      });
      expect(applied.matches.map((m) => m.id)).toEqual(
        proposed.map((m) => m.id),
      );
      expect(applied.audit.at(-1)?.event).toBe("shuffle_schedule");
    });
  }
  it("locks played slots and preserves clock slots while moving fixtures", () => {
    const c = create();
    c.matches = c.matches.map((m, i) => ({
      ...m,
      scheduledAt: new Date(Date.UTC(2026, 9, 14, 12, i * 10)).toISOString(),
    }));
    c.matches[0].status = "final";
    c.matches[1].status = "live";
    c.matches[2].status = "cancelled";
    const proposed = shuffleSchedule(c.matches, () => 0);
    expect(proposed.slice(0, 3)).toEqual(c.matches.slice(0, 3));
    expect(proposed.map((m) => m.scheduledAt)).toEqual(
      c.matches.map((m) => m.scheduledAt),
    );
    const applied = applyCommand(c, owner, {
      type: "shuffle_schedule",
      version: c.version,
      ids: proposed.map((m) => m.id),
    });
    expect(applied.matches.slice(0, 3)).toEqual(c.matches.slice(0, 3));
    for (const match of applied.matches) {
      const previous = c.matches.find((m) => m.id === match.id)!;
      expect(match.version).toBe(
        previous.version + (previous.scheduledAt !== match.scheduledAt ? 1 : 0),
      );
    }
  });
  it("rejects cross-round, cross-group, locked-slot, duplicate, unauthorized and stale proposals", () => {
    const c = create();
    const ids = c.matches.map((m) => m.id);
    const swapped = [...ids];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(() =>
      applyCommand(c, owner, {
        type: "shuffle_schedule",
        version: c.version,
        ids: swapped,
      }),
    ).toThrow("grup, putaran");
    const otherRound = c.matches.findIndex(
      (m) => m.group === c.matches[0].group && m.round !== c.matches[0].round,
    );
    const rounds = [...ids];
    [rounds[0], rounds[otherRound]] = [rounds[otherRound], rounds[0]];
    expect(() =>
      applyCommand(c, owner, {
        type: "shuffle_schedule",
        version: c.version,
        ids: rounds,
      }),
    ).toThrow("putaran");
    const duplicate = [...ids];
    duplicate[0] = duplicate[1];
    expect(() =>
      applyCommand(c, owner, {
        type: "shuffle_schedule",
        version: c.version,
        ids: duplicate,
      }),
    ).toThrow("Urutan");
    c.members.push({
      userId: operator.id,
      email: operator.email,
      role: "score_operator",
    });
    expect(() =>
      applyCommand(c, operator, {
        type: "shuffle_schedule",
        version: c.version,
        ids,
      }),
    ).toThrow("owner atau admin");
    expect(() =>
      applyCommand(c, owner, {
        type: "shuffle_schedule",
        version: c.version - 1,
        ids,
      }),
    ).toThrow("diperbarui");
    c.matches[0].status = "final";
    const locked = [...ids];
    [locked[0], locked[4]] = [locked[4], locked[0]];
    expect(() =>
      applyCommand(c, owner, {
        type: "shuffle_schedule",
        version: c.version,
        ids: locked,
      }),
    ).toThrow("tetap di posisinya");
  });
  it("reports no alternative when each round/group has only one eligible fixture", () => {
    const c = createCompetition(
      {
        name: "Two-team groups",
        format: "group_stage",
        groups: 4,
        meetings: 1,
        teamNames: Array.from({ length: 8 }, (_, i) => `T ${i}`),
      },
      owner,
    );
    expect(canShuffleSchedule(c.matches)).toBe(false);
    expect(shuffleSchedule(c.matches)).toEqual(c.matches);
  });
  it("keeps bronze and championship finals in their original roles", () => {
    const c = createCompetition(
      {
        name: "Knockout roles",
        format: "knockout",
        thirdPlace: true,
        teamNames: Array.from({ length: 8 }, (_, i) => `T ${i}`),
      },
      owner,
    );
    const proposed = shuffleSchedule(c.matches, () => 0);
    const finalRound = Math.max(...c.matches.map((m) => m.round));
    for (const [index, match] of c.matches.entries())
      if (match.round === finalRound) expect(proposed[index].id).toBe(match.id);
  });
});
