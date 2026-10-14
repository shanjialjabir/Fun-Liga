import { describe, it, expect } from "vitest";
import {
  createCompetition,
  applyCommand,
  standings,
  qualifiedTeams,
} from "../src/lib/competition";
const owner = { id: crypto.randomUUID(), email: "live-standings@example.test" };
function create(format: "league" | "group_then_knockout" = "league") {
  const c = createCompetition(
    {
      name: "Live standings",
      format,
      meetings: 1,
      groups: 2,
      qualifiers: 1,
      teamNames: ["A", "B", "C", "D"],
    },
    owner,
  );
  return applyCommand(c, owner, { type: "publish", version: c.version });
}
function live(c: ReturnType<typeof create>) {
  const m = c.matches[0];
  return applyCommand(c, owner, {
    type: "match_status",
    version: c.version,
    matchId: m.id,
    matchVersion: m.version,
    status: "live",
  });
}
function score(
  c: ReturnType<typeof create>,
  homeScore: number,
  awayScore: number,
) {
  const m = c.matches[0];
  return applyCommand(c, owner, {
    type: "score",
    version: c.version,
    matchId: m.id,
    matchVersion: m.version,
    homeScore,
    awayScore,
  });
}
describe("Live league and group standings", () => {
  it("recalculates draw, win, loss, goals and ranking as a live result changes", () => {
    let c = live(create());
    const m = c.matches[0];
    expect(standings(c).find((r) => r.team.id === m.home)).toMatchObject({
      played: 1,
      points: 1,
      draws: 1,
    });
    c = score(c, 2, 0);
    expect(standings(c)[0]).toMatchObject({
      team: { id: m.home },
      points: 3,
      wins: 1,
      gf: 2,
      ga: 0,
      gd: 2,
    });
    c = score(c, 2, 2);
    expect(standings(c).find((r) => r.team.id === m.home)).toMatchObject({
      points: 1,
      draws: 1,
      wins: 0,
      gd: 0,
    });
    c = score(c, 2, 3);
    expect(standings(c)[0]).toMatchObject({
      team: { id: m.away },
      points: 3,
      wins: 1,
      gf: 3,
      ga: 2,
      gd: 1,
    });
    expect(standings(c).find((r) => r.team.id === m.home)).toMatchObject({
      points: 0,
      losses: 1,
      gd: -1,
    });
    expect(standings(c, undefined, false).every((r) => r.played === 0)).toBe(
      true,
    );
  });
  it("does not count a live result twice when finalized and removes postponed results until resumed", () => {
    let c = score(live(create()), 1, 0);
    const before = standings(c);
    let m = c.matches[0];
    const final = applyCommand(c, owner, {
      type: "finalize",
      version: c.version,
      matchId: m.id,
      matchVersion: m.version,
      homeScore: 1,
      awayScore: 0,
      confirm: true,
    });
    expect(standings(final)).toEqual(before);
    expect(standings(final, undefined, false)).toEqual(before);
    c = applyCommand(c, owner, {
      type: "match_status",
      version: c.version,
      matchId: m.id,
      matchVersion: m.version,
      status: "postponed",
    });
    expect(standings(c).every((r) => r.played === 0)).toBe(true);
    m = c.matches[0];
    c = applyCommand(c, owner, {
      type: "match_status",
      version: c.version,
      matchId: m.id,
      matchVersion: m.version,
      status: "scheduled",
    });
    expect(standings(c).every((r) => r.played === 0)).toBe(true);
    c = live(c);
    expect(standings(c)).toEqual(before);
  });
  it("counts only the matching group and never treats a knockout fixture as a league result", () => {
    const c = score(live(create("group_then_knockout")), 2, 0);
    const m = c.matches[0];
    expect(standings(c, m.group!).some((r) => r.points === 3)).toBe(true);
    const other = m.group === "A" ? "B" : "A";
    expect(standings(c, other).every((r) => r.played === 0)).toBe(true);
    expect(() => qualifiedTeams(c)).toThrow("Selesaikan fase grup");
    const before = standings(c);
    c.matches.push({
      ...m,
      id: crypto.randomUUID(),
      stage: "knockout",
      group: null,
      homeScore: 99,
    });
    expect(standings(c)).toEqual(before);
  });
});
