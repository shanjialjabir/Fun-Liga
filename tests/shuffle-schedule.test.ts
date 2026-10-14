import { describe, expect, it } from "vitest";
import {
  createCompetition,
  applyCommand,
  shuffleSeasonSchedule,
  canShuffleSchedule,
  seasonRoundsAreOrdered,
  mirroredMeetings,
  validMatchWeeks,
  validSeasonDrawing,
  seasonLabel,
  type Match,
} from "../src/lib/competition";
const owner = { id: crypto.randomUUID(), email: "shuffle-owner@example.test" };
const operator = {
  id: crypto.randomUUID(),
  email: "shuffle-operator@example.test",
};
function create(
  format: "group_stage" | "league" | "knockout" = "group_stage",
  count = format === "group_stage" ? 16 : 8,
  groups = 4,
) {
  return createCompetition(
    {
      name: "Season drawing",
      format,
      groups,
      meetings: 2,
      teamNames: Array.from({ length: count }, (_, i) => `Team ${i + 1}`),
    },
    owner,
  );
}
function apply(
  c: ReturnType<typeof create>,
  matches: Match[],
  mirrorMeetings = true,
) {
  return applyCommand(c, owner, {
    type: "shuffle_schedule",
    version: c.version,
    ids: matches.map((m) => m.id),
    mirrorMeetings,
  });
}
function checkSeason(matches: Match[]) {
  expect(seasonRoundsAreOrdered(matches)).toBe(true);
  expect(validMatchWeeks(matches)).toBe(true);
  for (const group of new Set(matches.map((m) => m.group))) {
    for (const meeting of [1, 2]) {
      const leg = matches.filter(
        (m) => m.group === group && m.meeting === meeting,
      );
      const teams = new Set(leg.flatMap((m) => [m.home, m.away]));
      expect(leg).toHaveLength((teams.size * (teams.size - 1)) / 2);
      expect(
        new Set(leg.map((m) => [m.home, m.away].sort().join(":"))).size,
      ).toBe(leg.length);
      for (const round of new Set(leg.map((m) => m.round))) {
        const week = leg.filter((m) => m.round === round);
        expect(new Set(week.flatMap((m) => [m.home, m.away])).size).toBe(
          week.length * 2,
        );
      }
    }
  }
}
describe("Season halves and round-robin drawing", () => {
  for (const [format, count, groups] of [
    ["league", 8, 4],
    ["league", 7, 4],
    ["group_stage", 16, 4],
    ["group_stage", 11, 4],
  ] as const) {
    it(`draws ${format} with ${count} teams, mirrored halves and valid weeks`, () => {
      const c = create(format, count, groups);
      const before = structuredClone(c.matches);
      checkSeason(before);
      expect(mirroredMeetings(before)).toBe(true);
      const proposal = shuffleSeasonSchedule(c.matches, true, () => 0);
      checkSeason(proposal);
      expect(mirroredMeetings(proposal)).toBe(true);
      expect(canShuffleSchedule(c.matches)).toBe(true);
      expect(proposal.map((m) => m.id)).not.toEqual(before.map((m) => m.id));
      expect(proposal.map((m) => [m.stage, m.group, m.meeting])).toEqual(
        before.map((m) => [m.stage, m.group, m.meeting]),
      );
      expect(new Set(proposal.map((m) => m.id))).toEqual(
        new Set(before.map((m) => m.id)),
      );
      for (const m of proposal)
        expect(m).toMatchObject({
          ...before.find((x) => x.id === m.id)!,
          order: m.order,
        });
      expect(c.matches).toEqual(before);
      const applied = apply(c, proposal);
      expect(applied.matches.map((m) => m.id)).toEqual(
        proposal.map((m) => m.id),
      );
      expect(applied.rules.mirrorMeetings).toBe(true);
      expect(applied.audit.at(-1)?.after).toMatchObject({
        mirrorMeetings: true,
      });
      expect(
        proposal
          .filter((m) => m.meeting === 1)
          .every((m) => seasonLabel(m) === "Putaran 1"),
      ).toBe(true);
      expect(
        proposal
          .filter((m) => m.meeting === 2)
          .every((m) => seasonLabel(m) === "Putaran 2"),
      ).toBe(true);
    });
  }
  it("supports independent halves with different complete week orders and persists the choice", () => {
    const c = create("league");
    let seed = 7;
    const proposal = shuffleSeasonSchedule(c.matches, false, (max) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % max;
    });
    checkSeason(proposal);
    expect(mirroredMeetings(proposal)).toBe(false);
    expect(() => apply(c, proposal, true)).toThrow("opsi urutan");
    const applied = apply(c, proposal, false);
    expect(applied.rules.mirrorMeetings).toBe(false);
    const mirrored = shuffleSeasonSchedule(applied.matches, true, () => 0);
    expect(mirroredMeetings(mirrored)).toBe(true);
    expect(apply(applied, mirrored, true).rules.mirrorMeetings).toBe(true);
  });
  it("allows drawing complete weeks, but rejects broken weeks, cross-group/half and duplicates", () => {
    const c = create("league");
    const broken = [...c.matches];
    [broken[0], broken[4]] = [broken[4], broken[0]];
    expect(() => apply(c, broken, false)).toThrow("pekan pertandingan");
    const crossHalf = [...c.matches];
    [crossHalf[0], crossHalf[28]] = [crossHalf[28], crossHalf[0]];
    expect(() => apply(c, crossHalf, false)).toThrow("grup, putaran");
    const grouped = create();
    const crossGroup = [...grouped.matches];
    [crossGroup[0], crossGroup[1]] = [crossGroup[1], crossGroup[0]];
    expect(() => apply(grouped, crossGroup, false)).toThrow("grup, putaran");
    const duplicate = [...c.matches];
    duplicate[0] = duplicate[1];
    expect(() => apply(c, duplicate, false)).toThrow("Urutan");
  });
  it("preserves played positions, scores, and clock slots while drawing return fixtures", () => {
    const c = create("league");
    c.matches = c.matches.map((m, i) => ({
      ...m,
      scheduledAt: new Date(Date.UTC(2026, 9, 14, 12, i * 10)).toISOString(),
    }));
    c.matches[0].status = "final";
    c.matches[0].homeScore = 3;
    c.matches[1].status = "live";
    c.matches[2].status = "cancelled";
    const proposal = shuffleSeasonSchedule(c.matches, false, () => 0);
    expect(proposal.slice(0, 28)).toEqual(c.matches.slice(0, 28));
    expect(proposal.map((m) => m.scheduledAt)).toEqual(
      c.matches.map((m) => m.scheduledAt),
    );
    const applied = apply(c, proposal, false);
    expect(applied.matches.slice(0, 3)).toEqual(c.matches.slice(0, 3));
    for (const m of applied.matches) {
      const old = c.matches.find((x) => x.id === m.id)!;
      expect(m.version).toBe(
        old.version + (old.scheduledAt !== m.scheduledAt ? 1 : 0),
      );
    }
    const moved = [...proposal];
    [moved[0], moved[3]] = [moved[3], moved[0]];
    expect(() => apply(c, moved, false)).toThrow("tetap di posisinya");
  });
  it("does not apply mirror ordering that would move a played second-half fixture", () => {
    const c = create("league");
    c.matches[28].status = "live";
    const proposal = shuffleSeasonSchedule(c.matches, true, () => 0);
    expect(validSeasonDrawing(c.matches, proposal, true)).toBe(false);
    expect(() => apply(c, proposal)).toThrow("opsi urutan");
    const independent = shuffleSeasonSchedule(c.matches, false, () => 0);
    expect(validSeasonDrawing(c.matches, independent, false)).toBe(true);
    expect(independent[28]).toEqual(c.matches[28]);
  });
  it("repairs legacy mixed halves without losing fixtures and refuses to move locked half boundaries", () => {
    const c = create("league");
    [c.matches[0], c.matches[28]] = [c.matches[28], c.matches[0]];
    c.matches = c.matches.map((m, order) => ({ ...m, order }));
    expect(seasonRoundsAreOrdered(c.matches)).toBe(false);
    const proposal = shuffleSeasonSchedule(c.matches, true, () => 0);
    expect(validSeasonDrawing(c.matches, proposal, true)).toBe(true);
    checkSeason(apply(c, proposal).matches);
    c.matches[0].status = "live";
    const locked = shuffleSeasonSchedule(c.matches, true, () => 0);
    expect(locked[0]).toEqual(c.matches[0]);
    expect(validSeasonDrawing(c.matches, locked, true)).toBe(false);
    expect(() => apply(c, locked)).toThrow("Putaran 1 sebelum Putaran 2");
  });
  it("rejects unauthorized and stale changes", () => {
    const c = create();
    c.members.push({
      userId: operator.id,
      email: operator.email,
      role: "score_operator",
    });
    expect(() =>
      applyCommand(c, operator, {
        type: "shuffle_schedule",
        version: c.version,
        ids: c.matches.map((m) => m.id),
      }),
    ).toThrow("owner atau admin");
    expect(() =>
      applyCommand(c, owner, {
        type: "shuffle_schedule",
        version: c.version - 1,
        ids: c.matches.map((m) => m.id),
      }),
    ).toThrow("diperbarui");
  });
  it("handles a single meeting or two-team groups without inventing a second half", () => {
    const c = createCompetition(
      {
        name: "Small groups",
        format: "group_stage",
        groups: 4,
        meetings: 1,
        teamNames: Array.from({ length: 8 }, (_, i) => `T ${i}`),
      },
      owner,
    );
    expect(canShuffleSchedule(c.matches)).toBe(false);
    expect(shuffleSeasonSchedule(c.matches)).toEqual(c.matches);
    expect(c.matches.every((m) => seasonLabel(m) === "Putaran 1")).toBe(true);
  });
  it("preserves knockout round and winner/loser advancement roles", () => {
    const c = createCompetition(
      {
        name: "Knockout",
        format: "knockout",
        thirdPlace: true,
        teamNames: Array.from({ length: 8 }, (_, i) => `T ${i}`),
      },
      owner,
    );
    const proposal = shuffleSeasonSchedule(c.matches, true, () => 0);
    expect(proposal.map((m) => [m.round, m.sourceOutcome])).toEqual(
      c.matches.map((m) => [m.round, m.sourceOutcome]),
    );
    expect(apply(c, proposal).matches.map((m) => m.id)).toEqual(
      proposal.map((m) => m.id),
    );
    expect(proposal.every((m) => seasonLabel(m).startsWith("Babak "))).toBe(
      true,
    );
  });
});
