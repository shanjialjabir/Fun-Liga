import { describe, expect, it } from "vitest";
import {
  createCompetition,
  generateFixtures,
  applyCommand,
  balanceGroupSchedule,
} from "../src/lib/competition";
const owner = { id: crypto.randomUUID(), email: "group-owner@example.test" };
function create(
  format: "group_stage" | "group_then_knockout" = "group_stage",
  count = 16,
  groups = 4,
  meetings = 1,
) {
  return createCompetition(
    {
      name: "Fair group scheduling",
      format,
      teamNames: Array.from({ length: count }, (_, i) => `Team ${i + 1}`),
      groups,
      meetings,
      qualifiers: 2,
    },
    owner,
  );
}
describe("Fair group scheduling", () => {
  for (const format of ["group_stage", "group_then_knockout"] as const) {
    it(`interleaves ${format} A/B/C/D without missing or duplicating fixtures`, () => {
      const c = create(format);
      expect(c.matches.map((m) => m.group)).toEqual(
        Array.from({ length: 6 }, () => ["A", "B", "C", "D"]).flat(),
      );
      expect(new Set(c.matches.map((m) => m.id)).size).toBe(24);
      expect(c.matches.map((m) => m.order)).toEqual(
        Array.from({ length: 24 }, (_, i) => i),
      );
      const regenerated = generateFixtures(c);
      expect(regenerated.map((m) => m.group)).toEqual(
        c.matches.map((m) => m.group),
      );
      expect(
        c.matches.every(
          (m) =>
            c.teams.find((t) => t.id === m.home)?.group === m.group &&
            c.teams.find((t) => t.id === m.away)?.group === m.group,
        ),
      ).toBe(true);
    });
  }
  it("handles uneven groups, byes, and return meetings while keeping group-internal fixture order", () => {
    const c = create("group_stage", 11, 4, 2);
    expect(c.matches.slice(0, 8).map((m) => m.group)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "A",
      "B",
      "C",
      "A",
    ]);
    expect(c.matches.filter((m) => m.group === "D")).toHaveLength(2);
    expect(c.matches).toHaveLength(20);
    for (const group of ["A", "B", "C", "D"]) {
      const matches = c.matches.filter((m) => m.group === group);
      expect(matches.map((m) => m.round)).toEqual(
        [...matches.map((m) => m.round)].sort((a, b) => a - b),
      );
    }
  });
  it("balances old schedules without changing results or played positions; preserves time slots", () => {
    const c = create();
    c.matches.sort((a, b) => a.group!.localeCompare(b.group!));
    c.matches = c.matches.map((m, order) => ({
      ...m,
      order,
      scheduledAt: new Date(
        Date.UTC(2026, 9, 14, 12, order * 10),
      ).toISOString(),
    }));
    c.matches[0].status = "final";
    c.matches[0].homeScore = 2;
    c.matches[0].awayScore = 1;
    const original = structuredClone(c.matches);
    const reordered = balanceGroupSchedule(c.matches);
    expect(reordered[0]).toEqual(original[0]);
    expect(reordered.slice(1, 5).map((m) => m.group)).toEqual([
      "B",
      "C",
      "D",
      "A",
    ]);
    expect(reordered.map((m) => m.scheduledAt)).toEqual(
      original.map((m) => m.scheduledAt),
    );
    expect(new Set(reordered.map((m) => m.id))).toEqual(
      new Set(original.map((m) => m.id)),
    );
    const updated = applyCommand(c, owner, {
      type: "group_balance",
      version: c.version,
    });
    expect(updated.audit.at(-1)?.event).toBe("group_balance");
    expect(updated.matches[0]).toEqual(original[0]);
    expect(c.matches).toEqual(original);
  });
});
