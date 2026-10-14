import { z } from "zod";
import { TEAM_COLORS } from "./palette";

export const formats = {
  fourfeo: "Fourfeo",
  league: "Liga",
  group_stage: "Fase grup",
  knockout: "Gugur",
  group_then_knockout: "Grup + gugur",
} as const;
export type Format = keyof typeof formats;
export type Role = "owner" | "admin" | "score_operator";
export type MatchStatus =
  "scheduled" | "live" | "final" | "postponed" | "cancelled";
export type Team = {
  id: string;
  name: string;
  color: string;
  group: string | null;
};
export type Player = { id: string; teamId: string; name: string };
export type Goal = {
  id: string;
  teamId: string;
  creditedTeamId: string;
  scorerId: string | null;
  scorerName: string;
  assistId: string | null;
  assistName: string | null;
  minute: number | null;
  ownGoal: boolean;
};
export type Match = {
  id: string;
  home: string | null;
  away: string | null;
  stage: "group" | "league" | "knockout";
  group: string | null;
  round: number;
  meeting: number;
  order: number;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  homePenalty: number | null;
  awayPenalty: number | null;
  winner: string | null;
  sourceHome?: string;
  sourceAway?: string;
  sourceOutcome?: "winner" | "loser";
  scheduledAt: string | null;
  version: number;
  goals?: Goal[];
  goalBaseline?: { home: number; away: number };
};
export type Audit = {
  id: string;
  actor: string;
  event: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  at: string;
};
export type Competition = {
  id: string;
  slug: string;
  name: string;
  description: string;
  venue: string;
  startDate: string;
  format: Format;
  visibility: "public" | "unlisted" | "private";
  status:
    | "draft"
    | "published"
    | "in_progress"
    | "completed"
    | "archived"
    | "cancelled";
  ownerId: string;
  version: number;
  createdAt: string;
  teams: Team[];
  players?: Player[];
  committeeLinks?: {
    id: string;
    tokenHash?: string;
    role: "admin" | "score_operator";
    label: string;
    expiresAt: number;
  }[];
  matches: Match[];
  rules: {
    meetings: number;
    mirrorMeetings?: boolean;
    win: number;
    draw: number;
    loss: number;
    ranking: boolean;
    groups: number;
    qualifiers: number;
    thirdPlace: boolean;
  };
  members: { userId: string; email: string; role: Role }[];
  audit: Audit[];
  tieOrder: string[];
  knockoutDrawing?: { slots: (string | null)[]; avoidSameGroup: boolean };
};
export const competitionInput = z
  .object({
    name: z.string().trim().min(3, "Nama minimal 3 karakter").max(100),
    description: z.string().trim().max(1000).default(""),
    venue: z.string().trim().max(150).default(""),
    startDate: z.string().default(""),
    format: z.enum([
      "fourfeo",
      "league",
      "group_stage",
      "knockout",
      "group_then_knockout",
    ]),
    visibility: z.enum(["public", "unlisted", "private"]).default("public"),
    teamNames: z.array(z.string().trim().min(1).max(60)).min(2).max(32),
    meetings: z.number().int().min(1).max(10).default(2),
    win: z.number().int().min(0).max(20).default(3),
    draw: z.number().int().min(0).max(20).default(1),
    loss: z.number().int().min(0).max(20).default(0),
    ranking: z.boolean().default(true),
    groups: z.number().int().min(1).max(8).default(2),
    qualifiers: z.number().int().min(1).max(8).default(2),
    thirdPlace: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (
      new Set(v.teamNames.map((n) => n.toLocaleLowerCase())).size !==
      v.teamNames.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Nama tim harus unik",
        path: ["teamNames"],
      });
    if (v.format === "fourfeo" && v.teamNames.length !== 4)
      ctx.addIssue({
        code: "custom",
        message: "Fourfeo membutuhkan tepat 4 tim",
        path: ["teamNames"],
      });
    if (v.format.includes("group") && v.teamNames.length < v.groups * 2)
      ctx.addIssue({
        code: "custom",
        message: "Setiap grup membutuhkan minimal 2 tim",
        path: ["groups"],
      });
    if (
      v.format === "group_then_knockout" &&
      (v.qualifiers > Math.floor(v.teamNames.length / v.groups) ||
        v.qualifiers * v.groups < 2)
    )
      ctx.addIssue({
        code: "custom",
        message: "Jumlah tim yang lolos tidak valid",
        path: ["qualifiers"],
      });
  });
const colors = TEAM_COLORS;
const id = () => crypto.randomUUID();
function fixture(
  home: string | null,
  away: string | null,
  stage: Match["stage"],
  group: string | null,
  round: number,
  meeting: number,
  order: number,
): Match {
  return {
    id: id(),
    home,
    away,
    stage,
    group,
    round,
    meeting,
    order,
    status: "scheduled",
    homeScore: 0,
    awayScore: 0,
    homePenalty: null,
    awayPenalty: null,
    winner: null,
    scheduledAt: null,
    version: 0,
  };
}
export function roundRobin(
  teams: Team[],
  meetings: number,
  stage: "group" | "league" = "league",
  group: string | null = null,
): Match[] {
  const ring: (string | null)[] = teams.map((t) => t.id);
  if (ring.length % 2) ring.push(null);
  const base: Match[] = [];
  for (let r = 0; r < ring.length - 1; r++) {
    for (let i = 0; i < ring.length / 2; i++) {
      const a = ring[i],
        b = ring[ring.length - 1 - i];
      if (a && b)
        base.push(
          fixture(
            r % 2 ? b : a,
            r % 2 ? a : b,
            stage,
            group,
            r + 1,
            1,
            base.length,
          ),
        );
    }
    ring.splice(1, 0, ring.pop()!);
  }
  return Array.from({ length: meetings }, (_, meeting) =>
    base.map((m) => ({
      ...m,
      id: id(),
      home: meeting % 2 ? m.away : m.home,
      away: meeting % 2 ? m.home : m.away,
      meeting: meeting + 1,
      round: m.round + meeting * (ring.length - 1),
    })),
  )
    .flat()
    .map((m, order) => ({ ...m, order }));
}
export function interleaveGroups(
  matches: Match[],
  afterGroup?: string | null,
): Match[] {
  let groups = [...new Set(matches.map((m) => m.group))].sort();
  const previous = groups.indexOf(afterGroup ?? null);
  if (previous >= 0)
    groups = [...groups.slice(previous + 1), ...groups.slice(0, previous + 1)];
  const queues = groups.map((group) =>
    matches.filter((m) => m.group === group),
  );
  const result: Match[] = [];
  const meetings = [...new Set(matches.map((m) => m.meeting))].sort(
    (a, b) => a - b,
  );
  for (const meeting of meetings) {
    const weekQueues = queues.map((queue) => {
      const leg = queue.filter((m) => m.meeting === meeting);
      return [...new Set(leg.map((m) => m.round))]
        .sort((a, b) => a - b)
        .map((round) => leg.filter((m) => m.round === round));
    });
    const weeks = Math.max(0, ...weekQueues.map((q) => q.length));
    for (let week = 0; week < weeks; week++) {
      const dayQueues = weekQueues.map((q) => q[week] ?? []);
      const count = Math.max(0, ...dayQueues.map((q) => q.length));
      for (let index = 0; index < count; index++)
        for (const q of dayQueues) if (q[index]) result.push(q[index]);
    }
  }
  return result.map((match, order) => ({ ...match, order }));
}
export function balanceGroupSchedule(matches: Match[]): Match[] {
  const result: Match[] = [];
  let pending: Match[] = [];
  const flush = () => {
    const ordered = interleaveGroups(pending, result.at(-1)?.group);
    for (let index = 0; index < ordered.length; index++) {
      const match = ordered[index];
      const scheduledAt = pending[index].scheduledAt;
      result.push({
        ...match,
        scheduledAt,
        version: match.version + (scheduledAt !== match.scheduledAt ? 1 : 0),
      });
    }
    pending = [];
  };
  for (const match of matches) {
    if (
      match.stage === "group" &&
      ["scheduled", "postponed"].includes(match.status)
    )
      pending.push(match);
    else {
      flush();
      result.push(match);
    }
  }
  flush();
  return result.map((match, order) => ({ ...match, order }));
}
function scheduleBucket(match: Match) {
  return `${match.stage}:${match.group ?? ""}:${match.meeting}:${match.round}:${match.sourceOutcome ?? "winner"}`;
}
function randomIndex(max: number) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}
export function roundsAreOrdered(matches: Match[]) {
  return matches.every(
    (match, index) =>
      index === 0 ||
      match.stage !== matches[index - 1].stage ||
      match.round >= matches[index - 1].round,
  );
}
function roundOrderedSchedule(matches: Match[]) {
  if (roundsAreOrdered(matches)) return matches.map((match) => ({ ...match }));
  const result: Match[] = [];
  let pending: Match[] = [];
  const flush = () => {
    const firstRound = Math.min(...pending.map((match) => match.round));
    const previous = result.at(-1);
    const ordered =
      pending[0]?.stage === "group"
        ? interleaveGroups(
            pending,
            previous?.round === firstRound ? previous.group : undefined,
          )
        : [...pending].sort((a, b) => a.round - b.round);
    ordered.forEach((match, index) =>
      result.push({ ...match, scheduledAt: pending[index].scheduledAt }),
    );
    pending = [];
  };
  for (const match of matches) {
    if (!["scheduled", "postponed"].includes(match.status)) {
      flush();
      result.push(match);
    } else {
      if (pending.length && pending[0].stage !== match.stage) flush();
      pending.push(match);
    }
  }
  flush();
  return result.map((match, order) => ({ ...match, order }));
}
export function shuffleSchedule(
  matches: Match[],
  draw: (max: number) => number = randomIndex,
): Match[] {
  const ordered = roundOrderedSchedule(matches);
  const result = ordered.map((match) => ({ ...match }));
  const buckets = new Map<string, number[]>();
  ordered.forEach((match, index) => {
    if (!["scheduled", "postponed"].includes(match.status)) return;
    const key = scheduleBucket(match);
    const slots = buckets.get(key) ?? [];
    slots.push(index);
    buckets.set(key, slots);
  });
  for (const slots of buckets.values()) {
    const fixtures = slots.map((index) => ordered[index]);
    for (let i = fixtures.length - 1; i > 0; i--) {
      const j = draw(i + 1);
      [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]];
    }
    slots.forEach((slot, index) => {
      result[slot] = {
        ...fixtures[index],
        order: slot,
        scheduledAt: matches[slot].scheduledAt,
      };
    });
  }
  return result;
}
export function seasonRoundsAreOrdered(matches: Match[]) {
  return matches.every(
    (match, index) =>
      index === 0 ||
      match.stage !== matches[index - 1].stage ||
      (match.stage === "knockout"
        ? match.round >= matches[index - 1].round
        : match.meeting >= matches[index - 1].meeting),
  );
}
function seasonBaseSchedule(matches: Match[]) {
  if (seasonRoundsAreOrdered(matches)) return matches.map((m) => ({ ...m }));
  const out: Match[] = [];
  let pending: Match[] = [];
  const flush = () => {
    const ordered =
      pending[0]?.stage === "group"
        ? interleaveGroups(pending)
        : [...pending].sort(
            (a, b) => a.meeting - b.meeting || a.round - b.round,
          );
    ordered.forEach((m, i) =>
      out.push({ ...m, scheduledAt: pending[i].scheduledAt }),
    );
    pending = [];
  };
  for (const m of matches) {
    if (!["scheduled", "postponed"].includes(m.status)) {
      flush();
      out.push(m);
    } else {
      if (pending.length && pending[0].stage !== m.stage) flush();
      pending.push(m);
    }
  }
  flush();
  return out.map((m, order) => ({ ...m, order }));
}
function poolKey(match: Match) {
  return `${match.stage}:${match.group ?? ""}`;
}
function pairKey(match: Match) {
  return [match.home, match.away].sort().join(":");
}
export function mirroredMeetings(matches: Match[]) {
  const pools = [
    ...new Set(matches.filter((m) => m.stage !== "knockout").map(poolKey)),
  ];
  return pools.every((pool) => {
    const fixtures = matches.filter((m) => poolKey(m) === pool);
    const meetings = [...new Set(fixtures.map((m) => m.meeting))].sort(
      (a, b) => a - b,
    );
    const reference = fixtures.filter((m) => m.meeting === meetings[0]);
    return meetings.every((meeting) => {
      const leg = fixtures.filter((m) => m.meeting === meeting);
      return (
        leg.length === reference.length &&
        leg.every(
          (m, i) =>
            pairKey(m) === pairKey(reference[i]) &&
            ((meeting - meetings[0]) % 2
              ? m.home === reference[i].away && m.away === reference[i].home
              : m.home === reference[i].home && m.away === reference[i].away),
        )
      );
    });
  });
}
export function validMatchWeeks(matches: Match[]) {
  const pools = [
    ...new Set(
      matches
        .filter((m) => m.stage !== "knockout")
        .map((m) => `${poolKey(m)}:${m.meeting}`),
    ),
  ];
  return pools.every((pool) => {
    const fixtures = matches.filter(
      (m) => `${poolKey(m)}:${m.meeting}` === pool,
    );
    const completed = new Set<number>();
    let current: number | undefined;
    for (const m of fixtures) {
      if (m.round !== current) {
        if (completed.has(m.round)) return false;
        if (current !== undefined) completed.add(current);
        current = m.round;
      }
    }
    return true;
  });
}
export function shuffleSeasonSchedule(
  matches: Match[],
  mirror = true,
  draw: (max: number) => number = randomIndex,
): Match[] {
  const base = seasonBaseSchedule(matches);
  // Knockout brackets retain their original round and advancement roles.
  const result = base.map((match) => ({ ...match }));
  const knockoutSlots = base.flatMap((match, index) =>
    match.stage === "knockout" ? [index] : [],
  );
  const drawnKnockout = shuffleSchedule(
    knockoutSlots.map((index) => base[index]),
    draw,
  );
  knockoutSlots.forEach((slot, index) => {
    result[slot] = {
      ...drawnKnockout[index],
      order: slot,
      scheduledAt: matches[slot].scheduledAt,
    };
  });
  const shuffle = <T>(items: T[]) => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = draw(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const pools = [
    ...new Set(base.filter((m) => m.stage !== "knockout").map(poolKey)),
  ];
  for (const pool of pools) {
    const meetings = [
      ...new Set(base.filter((m) => poolKey(m) === pool).map((m) => m.meeting)),
    ].sort((a, b) => a - b);
    let reference: Match[] = [];
    for (const meeting of meetings) {
      const slots = base.flatMap((m, i) =>
        poolKey(m) === pool && m.meeting === meeting ? [i] : [],
      );
      const leg = slots.map((i) => base[i]);
      const movable = leg.every((m) =>
        ["scheduled", "postponed"].includes(m.status),
      );
      let plan = leg;
      if (mirror && reference.length && movable) {
        const byPair = new Map(leg.map((m) => [pairKey(m), m]));
        if (
          reference.length === leg.length &&
          reference.every((m) => byPair.has(pairKey(m)))
        )
          plan = reference.map((m) => byPair.get(pairKey(m))!);
      } else if (movable) {
        const weeks = [...new Set(leg.map((m) => m.round))].map((round) =>
          leg.filter((m) => m.round === round),
        );
        plan = shuffle(weeks).flatMap((week) => shuffle(week));
      }
      if (!reference.length) reference = plan;
      slots.forEach((slot, index) => {
        result[slot] = {
          ...plan[index],
          order: slot,
          scheduledAt: matches[slot].scheduledAt,
        };
      });
    }
  }
  return result;
}
export function validSeasonDrawing(
  original: Match[],
  proposal: Match[],
  mirror: boolean,
) {
  if (!seasonRoundsAreOrdered(proposal) || !validMatchWeeks(proposal))
    return false;
  if (
    original.some(
      (m, index) =>
        !["scheduled", "postponed"].includes(m.status) &&
        proposal[index]?.id !== m.id,
    )
  )
    return false;
  return !mirror || mirroredMeetings(proposal);
}
export function seasonLabel(match: Match) {
  return match.stage === "knockout"
    ? `Babak ${match.round}`
    : `Putaran ${match.meeting}`;
}
export function canShuffleSchedule(matches: Match[]) {
  for (const match of matches.filter((m) => m.stage !== "knockout")) {
    const leg = matches.filter(
      (m) => poolKey(m) === poolKey(match) && m.meeting === match.meeting,
    );
    if (
      leg.length > 1 &&
      leg.every((m) => ["scheduled", "postponed"].includes(m.status))
    )
      return true;
  }

  if (
    seasonBaseSchedule(matches).some(
      (match, index) => match.id !== matches[index].id,
    )
  )
    return true;
  const counts = new Map<string, number>();
  for (const match of matches) {
    if (
      match.stage !== "knockout" ||
      !["scheduled", "postponed"].includes(match.status)
    )
      continue;
    const key = scheduleBucket(match);
    const count = (counts.get(key) ?? 0) + 1;
    if (count > 1) return true;
    counts.set(key, count);
  }
  return false;
}
function drawItems<T>(
  items: T[],
  draw: (max: number) => number = randomIndex,
): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function drawGroups(
  teams: Team[],
  groups: number,
  draw: (max: number) => number = randomIndex,
): Team[] {
  const assignments = new Map(
    drawItems(teams, draw).map((team, index) => [
      team.id,
      String.fromCharCode(65 + (index % groups)),
    ]),
  );
  return teams.map((team) => ({ ...team, group: assignments.get(team.id)! }));
}
export function bracketSize(count: number) {
  let size = 2;
  while (size < count) size *= 2;
  return size;
}
export function validateBracketSlots(
  teams: Team[],
  slots: (string | null)[],
  avoidSameGroup = false,
) {
  const ids = slots.filter((slot): slot is string => slot !== null);
  if (
    slots.length !== bracketSize(teams.length) ||
    ids.length !== teams.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !teams.some((team) => team.id === id))
  )
    throw new DomainError(
      "Isi bagan dengan setiap tim lolos tepat satu kali dan jumlah bye yang sesuai",
    );
  for (let i = 0; i < slots.length; i += 2) {
    if (slots[i] === null && slots[i + 1] === null)
      throw new DomainError(
        "Dua bye tidak boleh berada dalam pasangan yang sama",
      );
    const home = teams.find((team) => team.id === slots[i]);
    const away = teams.find((team) => team.id === slots[i + 1]);
    if (avoidSameGroup && home?.group && home.group === away?.group)
      throw new DomainError(
        "Babak awal tidak boleh mempertemukan tim dari grup yang sama",
      );
  }
}
export function drawBracketSlots(
  teams: Team[],
  avoidSameGroup = true,
  draw: (max: number) => number = randomIndex,
): (string | null)[] {
  const shuffled = drawItems(teams, draw);
  const solve = (
    remaining: Team[],
    byes: number,
  ): (string | null)[][] | null => {
    if (!remaining.length) return byes === 0 ? [] : null;
    if (byes < 0 || byes > remaining.length) return null;
    if (avoidSameGroup) {
      const counts = new Map<string, number>();
      for (const team of remaining)
        if (team.group)
          counts.set(team.group, (counts.get(team.group) ?? 0) + 1);
      if (
        [...counts.values()].some(
          (count) => count > (remaining.length + byes) / 2,
        )
      )
        return null;
    }
    const first = remaining[0];
    for (let i = 1; i < remaining.length; i++) {
      const other = remaining[i];
      if (avoidSameGroup && first.group && first.group === other.group)
        continue;
      const next = solve(
        remaining.filter((_, index) => index !== 0 && index !== i),
        byes,
      );
      if (next) return [[first.id, other.id], ...next];
    }
    if (byes > 0) {
      const next = solve(remaining.slice(1), byes - 1);
      if (next) return [[first.id, null], ...next];
    }
    return null;
  };
  const pairs = solve(shuffled, bracketSize(teams.length) - teams.length);
  if (!pairs)
    throw new DomainError(
      "Drawing tanpa pertemuan sesama grup tidak memungkinkan. Pilih drawing bebas atau ubah aturan kompetisi.",
    );
  const slots = drawItems(pairs, draw).flatMap((pair) => drawItems(pair, draw));
  validateBracketSlots(teams, slots, avoidSameGroup);
  return slots;
}
export function qualifiedTeams(c: Competition): Team[] {
  if (c.format === "knockout") return c.teams;
  if (c.format !== "group_then_knockout")
    throw new DomainError("Format ini tidak memiliki babak gugur");
  if (
    c.matches
      .filter((match) => match.stage === "group")
      .some((match) => match.status !== "final" && match.status !== "cancelled")
  )
    throw new DomainError("Selesaikan fase grup terlebih dahulu");
  const qualified: Team[] = [];
  for (let i = 0; i < c.rules.groups; i++) {
    const rows = standings(c, String.fromCharCode(65 + i), false);
    if (rows.slice(0, c.rules.qualifiers).some((row) => row.tied))
      throw new DomainError(
        "Peringkat seri perlu keputusan panitia terlebih dahulu",
      );
    qualified.push(...rows.slice(0, c.rules.qualifiers).map((row) => row.team));
  }
  return qualified;
}
function startedMatchIds(c: Competition) {
  const ids = new Set<string>();
  for (const audit of c.audit)
    for (const value of [audit.before, audit.after]) {
      if (
        value &&
        typeof value === "object" &&
        "id" in value &&
        "status" in value &&
        typeof value.id === "string" &&
        ["live", "final"].includes(String(value.status))
      )
        ids.add(value.id);
    }
  return ids;
}
export function canDrawKnockout(c: Competition) {
  const started = startedMatchIds(c);
  return (
    ["knockout", "group_then_knockout"].includes(c.format) &&
    !["completed", "archived", "cancelled"].includes(c.status) &&
    c.matches
      .filter((match) => match.stage === "knockout")
      .every(
        (match) =>
          ["scheduled", "postponed"].includes(match.status) &&
          match.homeScore === 0 &&
          match.awayScore === 0 &&
          !match.goals?.length &&
          match.homePenalty === null &&
          match.awayPenalty === null &&
          !match.winner &&
          !started.has(match.id),
      )
  );
}

export function knockout(
  teams: Team[],
  thirdPlace = false,
  positions?: (string | null)[],
): Match[] {
  let size = 2;
  while (size < teams.length) size *= 2;
  let seeds = [1, 2];
  while (seeds.length < size)
    seeds = seeds.flatMap((s) => [s, seeds.length * 2 + 1 - s]);
  type Slot = { team: string | null; source?: string };
  if (positions) validateBracketSlots(teams, positions);
  let slots: Slot[] = positions
    ? positions.map((team) => ({ team }))
    : seeds.map((s) => ({ team: teams[s - 1]?.id ?? null }));
  const matches: Match[] = [];
  let round = 1;
  while (slots.length > 1) {
    const next: Slot[] = [];
    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i],
        b = slots[i + 1];
      if (!a.team && !a.source) {
        next.push(b);
        continue;
      }
      if (!b.team && !b.source) {
        next.push(a);
        continue;
      }
      const m = fixture(
        a.team,
        b.team,
        "knockout",
        null,
        round,
        1,
        matches.length,
      );
      m.sourceHome = a.source;
      m.sourceAway = b.source;
      matches.push(m);
      next.push({ team: null, source: m.id });
    }
    slots = next;
    round++;
  }
  if (thirdPlace) {
    const semi = matches.filter((m) => m.round === round - 2);
    if (semi.length === 2) {
      const m = fixture(
        null,
        null,
        "knockout",
        null,
        round - 1,
        1,
        matches.length,
      );
      m.sourceHome = semi[0].id;
      m.sourceAway = semi[1].id;
      m.sourceOutcome = "loser";
      matches.push(m);
    }
  }
  return matches;
}
export function createCompetition(
  input: unknown,
  user: { id: string; email: string },
): Competition {
  const v = competitionInput.parse(input);
  const cid = id();
  const grouped = v.format.includes("group");
  let teams = v.teamNames.map((name, i) => ({
    id: id(),
    name,
    color: colors[i % colors.length],
    group: grouped ? String.fromCharCode(65 + (i % v.groups)) : null,
  }));
  if (grouped) teams = drawGroups(teams, v.groups);
  let matches =
    v.format === "knockout"
      ? knockout(teams, v.thirdPlace)
      : grouped
        ? Array.from({ length: v.groups }, (_, i) =>
            String.fromCharCode(65 + i),
          ).flatMap((g) =>
            roundRobin(
              teams.filter((t) => t.group === g),
              v.meetings,
              "group",
              g,
            ),
          )
        : roundRobin(teams, v.meetings);
  matches = (grouped ? interleaveGroups(matches) : matches).map((m, order) => ({
    ...m,
    order,
  }));
  return {
    id: cid,
    slug: `${
      v.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "kompetisi"
    }-${cid.slice(0, 8)}`,
    name: v.name,
    description: v.description,
    venue: v.venue,
    startDate: v.startDate,
    format: v.format,
    visibility: v.visibility,
    status: "draft",
    ownerId: user.id,
    version: 0,
    createdAt: new Date().toISOString(),
    teams,
    matches,
    rules: {
      meetings: v.meetings,
      mirrorMeetings: true,
      win: v.win,
      draw: v.draw,
      loss: v.loss,
      ranking: v.ranking,
      groups: v.groups,
      qualifiers: v.qualifiers,
      thirdPlace: v.thirdPlace,
    },
    members: [{ userId: user.id, email: user.email, role: "owner" }],
    audit: [],
    tieOrder: [],
  };
}
export function generateFixtures(
  c: Pick<Competition, "format" | "teams" | "rules">,
): Match[] {
  const generated =
    c.format === "knockout"
      ? knockout(c.teams, c.rules.thirdPlace)
      : c.format.includes("group")
        ? Array.from({ length: c.rules.groups }, (_, i) =>
            String.fromCharCode(65 + i),
          ).flatMap((g) =>
            roundRobin(
              c.teams.filter((t) => t.group === g),
              c.rules.meetings,
              "group",
              g,
            ),
          )
        : roundRobin(c.teams, c.rules.meetings);
  return (
    c.format.includes("group") ? interleaveGroups(generated) : generated
  ).map((m, order) => ({ ...m, order }));
}
export function prioritizeRest(matches: Match[]): Match[] {
  if (matches.some((match) => match.stage === "group"))
    return balanceGroupSchedule(matches);
  const remaining = [...matches],
    out: Match[] = [];
  while (remaining.length) {
    const previous = out.at(-1);
    if (!["scheduled", "postponed"].includes(remaining[0].status)) {
      out.push(remaining.shift()!);
      continue;
    }
    const anchor = remaining.findIndex(
      (m) => !["scheduled", "postponed"].includes(m.status),
    );
    const stop = anchor === -1 ? remaining.length : anchor;
    const index = remaining
      .slice(0, stop)
      .findIndex(
        (m) =>
          !previous ||
          ![m.home, m.away].some(
            (t) => t && (t === previous.home || t === previous.away),
          ),
      );
    out.push(remaining.splice(index < 0 ? 0 : index, 1)[0]);
  }
  return out.map((m, order) => ({ ...m, order }));
}
export type Standing = {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  tied: boolean;
  position: number;
};
export function standings(
  c: Competition,
  group?: string,
  includeLive = true,
): Standing[] {
  const teams = c.teams.filter((t) => !group || t.group === group);
  const rows = teams.map((team) => ({
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    tied: false,
    position: 0,
  }));
  const counted = c.matches.filter(
    (m) =>
      (m.status === "final" || (includeLive && m.status === "live")) &&
      m.stage !== "knockout" &&
      (!group || m.group === group),
  );
  for (const m of counted) {
    for (const row of rows) {
      if (row.team.id !== m.home && row.team.id !== m.away) continue;
      const home = row.team.id === m.home;
      const gf = home ? m.homeScore : m.awayScore,
        ga = home ? m.awayScore : m.homeScore;
      row.played++;
      row.gf += gf;
      row.ga += ga;
      if (gf > ga) {
        row.wins++;
        row.points += c.rules.win;
      } else if (gf === ga) {
        row.draws++;
        row.points += c.rules.draw;
      } else {
        row.losses++;
        row.points += c.rules.loss;
      }
      row.gd = row.gf - row.ga;
    }
  }
  const base = (a: Standing, b: Standing) =>
    b.points - a.points || b.gd - a.gd || b.gf - a.gf;
  rows.sort(base);
  let start = 0;
  while (start < rows.length) {
    let end = start + 1;
    while (end < rows.length && base(rows[start], rows[end]) === 0) end++;
    const set = rows.slice(start, end);
    const ids = new Set(set.map((r) => r.team.id));
    const mini = new Map(set.map((r) => [r.team.id, { p: 0, gd: 0, gf: 0 }]));
    for (const m of counted.filter(
      (m) => ids.has(m.home!) && ids.has(m.away!),
    )) {
      for (const [tid, gf, ga] of [
        [m.home, m.homeScore, m.awayScore],
        [m.away, m.awayScore, m.homeScore],
      ] as [string, number, number][]) {
        const r = mini.get(tid)!;
        r.p += gf > ga ? c.rules.win : gf === ga ? c.rules.draw : c.rules.loss;
        r.gd += gf - ga;
        r.gf += gf;
      }
    }
    const head = (a: Standing, b: Standing) => {
      const x = mini.get(a.team.id)!,
        y = mini.get(b.team.id)!;
      return y.p - x.p || y.gd - x.gd || y.gf - x.gf;
    };
    const manual = (a: Standing, b: Standing) =>
      c.tieOrder.includes(a.team.id) && c.tieOrder.includes(b.team.id)
        ? c.tieOrder.indexOf(a.team.id) - c.tieOrder.indexOf(b.team.id)
        : 0;
    set.sort(
      (a, b) =>
        head(a, b) || manual(a, b) || a.team.name.localeCompare(b.team.name),
    );
    for (let i = 0; i < set.length; i++) {
      set[i].tied = set.some(
        (other, j) => i !== j && !head(set[i], other) && !manual(set[i], other),
      );
      set[i].position =
        i > 0 &&
        head(set[i], set[i - 1]) === 0 &&
        manual(set[i], set[i - 1]) === 0
          ? set[i - 1].position
          : start + i + 1;
      rows[start + i] = set[i];
    }
    start = end;
  }
  return rows;
}
export function restWarnings(matches: Match[]): Set<string> {
  const set = new Set<string>();
  for (let i = 1; i < matches.length; i++) {
    const a = matches[i - 1],
      b = matches[i];
    if ([a.home, a.away].some((t) => t && (t === b.home || t === b.away)))
      set.add(b.id);
  }
  return set;
}
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function roleFor(
  c: Competition,
  userId: string | undefined,
): Role | undefined {
  if (userId?.startsWith("link:"))
    return c.committeeLinks?.find(
      (link) => link.id === userId.slice(5) && link.expiresAt > Date.now(),
    )?.role;
  return c.members.find((m) => m.userId === userId)?.role;
}
export function canView(c: Competition, userId?: string) {
  return (
    !!roleFor(c, userId) || (c.status !== "draft" && c.visibility !== "private")
  );
}
export function normalizePlayerName(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ");
}
export function playerNameKey(name: string) {
  return normalizePlayerName(name).toLocaleLowerCase("id-ID");
}
function resolvePlayer(c: Competition, teamId: string, name: string): Player {
  c.players ??= [];
  const existing = c.players.find(
    (p) => p.teamId === teamId && playerNameKey(p.name) === playerNameKey(name),
  );
  if (existing) return existing;
  const player = { id: id(), teamId, name };
  c.players.push(player);
  return player;
}
export function recordedScore(match: Match) {
  const baseline = match.goalBaseline ?? {
    home: match.homeScore,
    away: match.awayScore,
  };
  return {
    home:
      baseline.home +
      (match.goals ?? []).filter((g) => g.creditedTeamId === match.home).length,
    away:
      baseline.away +
      (match.goals ?? []).filter((g) => g.creditedTeamId === match.away).length,
  };
}
export function playerStatistics(c: Competition) {
  const rows = new Map<string, Player & { goals: number; assists: number }>();
  const row = (playerId: string, teamId: string, name: string) => {
    if (!rows.has(playerId))
      rows.set(playerId, { id: playerId, teamId, name, goals: 0, assists: 0 });
    return rows.get(playerId)!;
  };
  for (const m of c.matches.filter((match) =>
    ["live", "final"].includes(match.status),
  )) {
    for (const g of m.goals ?? []) {
      if (g.ownGoal) continue;
      if (g.scorerId && g.scorerName)
        row(g.scorerId, g.teamId, g.scorerName).goals++;
      if (g.assistId && g.assistName)
        row(g.assistId, g.teamId, g.assistName).assists++;
    }
  }
  return [...rows.values()];
}

export function applyCommand(
  original: Competition,
  user: { id: string; email: string; name?: string; guest?: boolean },
  command: Record<string, unknown>,
): Competition {
  const c = structuredClone(original);
  const role = roleFor(c, user.id);
  if (!role) throw new DomainError("Anda tidak memiliki akses", 403);
  if (command.type === "finalize" && command.confirm === true) {
    const m = c.matches.find((m) => m.id === command.matchId);
    if (
      m?.status === "final" &&
      m.homeScore === command.homeScore &&
      m.awayScore === command.awayScore &&
      (m.homePenalty ?? null) === (command.homePenalty ?? null) &&
      (m.awayPenalty ?? null) === (command.awayPenalty ?? null)
    )
      return c;
  }
  if (command.version !== c.version)
    throw new DomainError(
      "Data telah diperbarui oleh panitia lain. Muat ulang sebelum menyimpan.",
      409,
    );
  const type = String(command.type);
  const scoring = [
    "score",
    "finalize",
    "correct",
    "match_status",
    "goal_add",
    "goal_update",
    "goal_delete",
  ];
  if (!scoring.includes(type) && role === "score_operator")
    throw new DomainError(
      "Hanya owner atau admin yang dapat melakukan tindakan ini",
      403,
    );
  if (
    ["archived", "completed", "cancelled"].includes(c.status) &&
    scoring.includes(type)
  )
    throw new DomainError("Kompetisi sudah ditutup");
  let before: unknown = null,
    after: unknown = null;
  let reason: string | null = null;
  const findMatch = () => {
    const m = c.matches.find((m) => m.id === command.matchId);
    if (!m) throw new DomainError("Pertandingan tidak ditemukan", 404);
    if (command.matchVersion !== m.version)
      throw new DomainError("Skor telah berubah. Muat ulang.", 409);
    return m;
  };
  if (type === "publish") {
    if (c.status !== "draft")
      throw new DomainError("Kompetisi sudah dipublikasikan");
    if (!c.matches.length) throw new DomainError("Jadwal belum tersedia");
    c.status = "published";
  } else if (type === "lifecycle") {
    const status = z
      .enum(["completed", "archived", "cancelled"])
      .parse(command.status);
    if (c.status === "draft")
      throw new DomainError("Publikasikan kompetisi terlebih dahulu");
    if (c.matches.some((m) => m.status === "live"))
      throw new DomainError("Selesaikan pertandingan live terlebih dahulu");
    if (
      status === "completed" &&
      c.matches.some(
        (m) => m.status === "scheduled" || m.status === "postponed",
      )
    )
      throw new DomainError("Masih ada pertandingan yang belum selesai");
    c.status = status;
  } else if (type === "group_balance") {
    if (!c.format.includes("group"))
      throw new DomainError("Kompetisi ini tidak memakai grup");
    if (["archived", "completed", "cancelled"].includes(c.status))
      throw new DomainError("Kompetisi sudah ditutup");
    before = structuredClone(c.matches);
    c.matches = balanceGroupSchedule(c.matches);
    after = structuredClone(c.matches);
  } else if (type === "reorder" || type === "shuffle_schedule") {
    const expectedSlots =
      type === "shuffle_schedule" ? seasonBaseSchedule(c.matches) : c.matches;
    if (
      type === "shuffle_schedule" &&
      ["archived", "completed", "cancelled"].includes(c.status)
    )
      throw new DomainError("Kompetisi sudah ditutup");
    const mirror =
      command.mirrorMeetings === undefined
        ? (c.rules.mirrorMeetings ?? true)
        : z.boolean().parse(command.mirrorMeetings);
    const ids = z.array(z.string()).parse(command.ids);
    if (
      ids.length !== c.matches.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !c.matches.some((m) => m.id === id))
    )
      throw new DomainError("Urutan pertandingan tidak valid");
    for (const m of c.matches.filter(
      (m) => m.status !== "scheduled" && m.status !== "postponed",
    ))
      if (ids.indexOf(m.id) !== m.order)
        throw new DomainError(
          "Pertandingan yang dimulai harus tetap di posisinya",
        );
    if (
      type === "shuffle_schedule" &&
      ids.some((id, index) =>
        expectedSlots[index].stage === "knockout"
          ? scheduleBucket(c.matches.find((m) => m.id === id)!) !==
            scheduleBucket(expectedSlots[index])
          : poolKey(c.matches.find((m) => m.id === id)!) !==
              poolKey(expectedSlots[index]) ||
            c.matches.find((m) => m.id === id)!.meeting !==
              expectedSlots[index].meeting,
      )
    )
      throw new DomainError(
        "Pengacakan harus mempertahankan grup, putaran, dan pertemuan awal",
      );
    if (
      type === "shuffle_schedule" &&
      !validSeasonDrawing(
        c.matches,
        ids.map((id) => c.matches.find((m) => m.id === id)!),
        mirror,
      )
    )
      throw new DomainError(
        "Jadwal harus menyelesaikan Putaran 1 sebelum Putaran 2, menjaga pekan pertandingan, dan mengikuti opsi urutan antarputaran tanpa memindahkan pertandingan yang sudah berjalan.",
      );
    before =
      type === "shuffle_schedule"
        ? {
            fixtureIds: c.matches.map((m) => m.id),
            timeSlots: c.matches.map((m) => m.scheduledAt),
            mirrorMeetings: c.rules.mirrorMeetings ?? true,
          }
        : c.matches.map((m) => m.id);
    if (type === "shuffle_schedule") c.rules.mirrorMeetings = mirror;
    c.matches = ids.map((id, order) => ({
      ...c.matches.find((m) => m.id === id)!,
      order,
      ...(type === "shuffle_schedule"
        ? {
            scheduledAt: c.matches[order].scheduledAt,
            version:
              c.matches.find((m) => m.id === id)!.version +
              (c.matches.find((m) => m.id === id)!.scheduledAt !==
              c.matches[order].scheduledAt
                ? 1
                : 0),
          }
        : {}),
    }));
    after =
      type === "shuffle_schedule"
        ? {
            fixtureIds: ids,
            timeSlots: c.matches.map((m) => m.scheduledAt),
            mirrorMeetings: mirror,
          }
        : ids;
  } else if (type === "schedule") {
    const m = findMatch();
    if (!["scheduled", "postponed"].includes(m.status))
      throw new DomainError("Jadwal pertandingan ini sudah terkunci");
    const at = z
      .string()
      .datetime({ offset: true })
      .nullable()
      .parse(command.scheduledAt);
    before = m.scheduledAt;
    m.scheduledAt = at;
    m.version++;
    after = at;
  } else if (type === "settings") {
    const v = z
      .object({
        name: z.string().trim().min(3).max(100),
        venue: z.string().max(150),
        description: z.string().max(1000),
        visibility: z.enum(["public", "unlisted", "private"]),
      })
      .parse(command.settings);
    before = {
      name: c.name,
      venue: c.venue,
      description: c.description,
      visibility: c.visibility,
    };
    Object.assign(c, v);
    after = v;
  } else if (type === "group_draw") {
    if (c.status !== "draft" || !c.format.includes("group"))
      throw new DomainError(
        "Drawing grup hanya tersedia pada draft kompetisi grup",
      );
    if (
      c.matches.some(
        (match) =>
          !["scheduled", "postponed"].includes(match.status) ||
          match.homeScore !== 0 ||
          match.awayScore !== 0 ||
          !!match.goals?.length,
      )
    )
      throw new DomainError(
        "Drawing grup terkunci setelah pertandingan dimulai",
      );
    if (command.confirm !== true)
      throw new DomainError(
        "Konfirmasikan drawing grup dan pembuatan ulang jadwal draft",
      );
    const assignments = z
      .array(z.object({ id: z.string(), group: z.string() }))
      .parse(command.assignments);
    const groups = Array.from({ length: c.rules.groups }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    if (
      assignments.length !== c.teams.length ||
      new Set(assignments.map((t) => t.id)).size !== c.teams.length ||
      assignments.some(
        (t) =>
          !c.teams.some((old) => old.id === t.id) || !groups.includes(t.group),
      )
    )
      throw new DomainError("Peserta atau grup drawing tidak valid");
    const counts = groups.map(
      (group) => assignments.filter((t) => t.group === group).length,
    );
    if (
      counts.some(
        (count) =>
          count <
          Math.max(
            2,
            c.format === "group_then_knockout" ? c.rules.qualifiers : 2,
          ),
      )
    )
      throw new DomainError(
        "Setiap grup harus memenuhi jumlah minimal tim dan tim lolos",
      );
    before = { teams: c.teams, matches: c.matches };
    c.teams = c.teams.map((team) => ({
      ...team,
      group: assignments.find((t) => t.id === team.id)!.group,
    }));
    c.matches = generateFixtures(c);
    delete c.knockoutDrawing;
    c.tieOrder = [];
    after = { teams: c.teams, matches: c.matches };
  } else if (type === "knockout_draw") {
    if (!canDrawKnockout(c))
      throw new DomainError(
        "Bagan terkunci setelah pertandingan gugur dimulai atau kompetisi ditutup",
      );
    if (command.confirm !== true)
      throw new DomainError("Konfirmasikan drawing bagan gugur");
    const qualified = qualifiedTeams(c);
    const slots = z.array(z.string().nullable()).parse(command.slots);
    const avoidSameGroup = z
      .boolean()
      .parse(
        command.avoidSameGroup ??
          (c.format === "group_then_knockout" && c.rules.groups > 1),
      );
    validateBracketSlots(qualified, slots, avoidSameGroup);
    const old = c.matches.filter((match) => match.stage === "knockout");
    const groupMatches = c.matches.filter(
      (match) => match.stage !== "knockout",
    );
    before = old;
    const drawn = knockout(qualified, c.rules.thirdPlace, slots).map(
      (match, index) => ({
        ...match,
        order: groupMatches.length + index,
        scheduledAt: old[index]?.scheduledAt ?? null,
      }),
    );
    c.matches = [...groupMatches, ...drawn];
    c.knockoutDrawing = { slots, avoidSameGroup };
    after = { slots, avoidSameGroup, matches: drawn };
  } else if (type === "teams") {
    if (c.status !== "draft")
      throw new DomainError("Tim terkunci setelah publikasi");
    const v = z
      .array(
        z.object({
          id: z.string(),
          name: z.string().trim().min(1).max(60),
          group: z.string().nullable(),
        }),
      )
      .min(2)
      .max(32)
      .parse(command.teams);
    competitionInput.parse({
      name: c.name,
      format: c.format,
      teamNames: v.map((t) => t.name),
      ...c.rules,
    });
    if (
      new Set(v.map((t) => t.id)).size !== v.length ||
      v.some(
        (t) => !t.id.startsWith("new-") && !c.teams.some((x) => x.id === t.id),
      )
    )
      throw new DomainError("Identitas tim tidak valid");
    if (!c.format.includes("group") && v.some((t) => t.group !== null))
      throw new DomainError("Format ini tidak memiliki grup");
    if (c.format.includes("group")) {
      const groups = Array.from({ length: c.rules.groups }, (_, i) =>
        String.fromCharCode(65 + i),
      );
      if (
        v.some((t) => !groups.includes(t.group!)) ||
        groups.some(
          (g) =>
            v.filter((t) => t.group === g).length <
            Math.max(
              2,
              c.format === "group_then_knockout" ? c.rules.qualifiers : 2,
            ),
        )
      )
        throw new DomainError(
          "Alokasi grup tidak memenuhi jumlah minimal tim atau tim lolos",
        );
    }
    const changedSchedule =
      v.length !== c.teams.length ||
      v.some(
        (t) => !c.teams.some((old) => old.id === t.id && old.group === t.group),
      );
    if (changedSchedule && command.confirm !== true)
      throw new DomainError(
        "Perubahan peserta atau grup memerlukan konfirmasi pembuatan ulang jadwal",
      );
    before = c.teams;
    c.teams = v.map((t, i) => {
      const old = c.teams.find((x) => x.id === t.id);
      return {
        id: old?.id || id(),
        name: t.name,
        group: t.group,
        color: old?.color || colors[i % colors.length],
      };
    });
    if (changedSchedule) {
      c.matches = generateFixtures(c);
      delete c.knockoutDrawing;
      c.tieOrder = [];
    }
    after = c.teams;
  } else if (type === "rules") {
    if (c.status !== "draft")
      throw new DomainError("Aturan terkunci setelah publikasi");
    if (command.confirm !== true)
      throw new DomainError("Pembuatan ulang jadwal memerlukan konfirmasi");
    const input = z.record(z.string(), z.unknown()).parse(command.rules);
    const v = competitionInput.parse({
      ...input,
      name: c.name,
      format: c.format,
      teamNames: c.teams.map((t) => t.name),
    });
    before = c.rules;
    if (c.format.includes("group") && v.groups !== c.rules.groups)
      c.teams = c.teams.map((t, i) => ({
        ...t,
        group: String.fromCharCode(65 + (i % v.groups)),
      }));
    if (
      c.format === "group_then_knockout" &&
      Array.from({ length: v.groups }, (_, i) =>
        String.fromCharCode(65 + i),
      ).some((g) => c.teams.filter((t) => t.group === g).length < v.qualifiers)
    )
      throw new DomainError("Tim lolos melebihi ukuran grup");
    c.rules = {
      meetings: v.meetings,
      mirrorMeetings: c.rules.mirrorMeetings ?? true,
      win: v.win,
      draw: v.draw,
      loss: v.loss,
      ranking: v.ranking,
      groups: v.groups,
      qualifiers: v.qualifiers,
      thirdPlace: v.thirdPlace,
    };
    c.matches = generateFixtures(c);
    delete c.knockoutDrawing;
    c.tieOrder = [];
    after = c.rules;
  } else if (type === "transfer") {
    if (role !== "owner")
      throw new DomainError("Hanya owner dapat memindahkan kepemilikan", 403);
    if (command.confirm !== true)
      throw new DomainError("Transfer memerlukan konfirmasi");
    const target = c.members.find((m) => m.userId === command.userId);
    if (!target || target.userId === c.ownerId)
      throw new DomainError("Pilih anggota panitia lain");
    before = c.ownerId;
    c.members = c.members.map((m) => ({
      ...m,
      role:
        m.userId === target.userId
          ? "owner"
          : m.role === "owner"
            ? "admin"
            : m.role,
    }));
    c.ownerId = target.userId;
    after = c.ownerId;
  } else if (type === "qualify") {
    if (
      c.format !== "group_then_knockout" ||
      c.matches.some((m) => m.stage === "knockout")
    )
      throw new DomainError("Bracket tidak dapat dibuat ulang");
    if (c.matches.some((m) => m.status !== "final" && m.status !== "cancelled"))
      throw new DomainError("Selesaikan fase grup terlebih dahulu");
    const qualified = qualifiedTeams(c);
    const slots = drawBracketSlots(qualified, c.rules.groups > 1);
    c.knockoutDrawing = { slots, avoidSameGroup: c.rules.groups > 1 };
    c.matches.push(
      ...knockout(qualified, c.rules.thirdPlace, slots).map((m, i) => ({
        ...m,
        order: c.matches.length + i,
      })),
    );
    after = qualified.map((t) => t.id);
  } else if (type === "resolve_tie") {
    const ids = z.array(z.string()).parse(command.ids);
    if (
      ids.length !== c.teams.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !c.teams.some((t) => t.id === id))
    )
      throw new DomainError("Keputusan urutan tim tidak valid");
    reason = z.string().trim().min(5).max(500).parse(command.reason);
    before = c.tieOrder;
    c.tieOrder = ids;
    after = ids;
  } else if (type === "revoke_committee_link") {
    const link = c.committeeLinks?.find((link) => link.id === command.linkId);
    if (!link) throw new DomainError("Akses tautan tidak ditemukan", 404);
    if (role !== "owner" && link.role === "admin")
      throw new DomainError("Hanya owner dapat mencabut tautan admin", 403);
    before = {
      id: link.id,
      role: link.role,
      label: link.label,
      expiresAt: link.expiresAt,
    };
    c.committeeLinks = c.committeeLinks!.filter((item) => item.id !== link.id);
    after = null;
  } else if (type === "revoke") {
    if (command.userId === c.ownerId)
      throw new DomainError("Owner terakhir tidak dapat dihapus");
    if (
      role !== "owner" &&
      c.members.find((m) => m.userId === command.userId)?.role === "admin"
    )
      throw new DomainError("Hanya owner dapat menghapus admin", 403);
    before = c.members;
    c.members = c.members.filter((m) => m.userId !== command.userId);
    after = c.members;
  } else if (scoring.includes(type)) {
    if (c.status === "draft")
      throw new DomainError("Publikasikan kompetisi sebelum mengisi skor");
    const m = findMatch();
    before = structuredClone(m);
    if (["goal_add", "goal_update", "goal_delete"].includes(type)) {
      if (!m.home || !m.away) throw new DomainError("Peserta belum lengkap");
      if (!["scheduled", "live", "final"].includes(m.status))
        throw new DomainError("Gol tidak dapat diubah pada status ini");
      const wasFinal = m.status === "final";
      if (wasFinal) {
        if (command.confirm !== true)
          throw new DomainError("Koreksi gol final memerlukan konfirmasi");
        reason = z
          .string()
          .trim()
          .min(5, "Alasan koreksi minimal 5 karakter")
          .max(500)
          .parse(command.reason);
      }
      m.goals ??= [];
      m.goalBaseline ??= { home: m.homeScore, away: m.awayScore };
      if (type === "goal_delete") {
        const index = m.goals.findIndex((goal) => goal.id === command.goalId);
        if (index < 0)
          throw new DomainError("Catatan gol tidak ditemukan", 404);
        m.goals.splice(index, 1);
      } else {
        const input = z
          .object({
            teamId: z.string(),
            scorerName: z
              .string()
              .transform(normalizePlayerName)
              .pipe(z.string().max(80))
              .default(""),
            assistName: z
              .string()
              .transform(normalizePlayerName)
              .pipe(z.string().max(80))
              .default(""),
            minute: z.number().int().min(0).max(999).nullable().default(null),
            ownGoal: z.boolean().default(false),
            existing: z.boolean().default(false),
          })
          .parse(command);
        if (![m.home, m.away].includes(input.teamId))
          throw new DomainError("Pemain harus berasal dari tim pertandingan");
        if (input.ownGoal && input.assistName)
          throw new DomainError("Gol bunuh diri tidak memiliki assist");
        const scorer = input.scorerName
          ? resolvePlayer(c, input.teamId, input.scorerName)
          : null;
        const assist = input.assistName
          ? resolvePlayer(c, input.teamId, input.assistName)
          : null;
        if (scorer && assist?.id === scorer.id)
          throw new DomainError(
            "Pencetak gol dan pemberi assist harus berbeda",
          );
        const creditedTeamId = input.ownGoal
          ? input.teamId === m.home
            ? m.away
            : m.home
          : input.teamId;
        const goal: Goal = {
          id: id(),
          teamId: input.teamId,
          creditedTeamId,
          scorerId: scorer?.id ?? null,
          scorerName: scorer?.name ?? "",
          assistId: assist?.id ?? null,
          assistName: assist?.name ?? null,
          minute: input.minute,
          ownGoal: input.ownGoal,
        };
        if (type === "goal_update") {
          const index = m.goals.findIndex((g) => g.id === command.goalId);
          if (index < 0)
            throw new DomainError("Catatan gol tidak ditemukan", 404);
          goal.id = m.goals[index].id;
          m.goals[index] = goal;
        } else {
          if (input.existing) {
            const side = creditedTeamId === m.home ? "home" : "away";
            if (m.goalBaseline[side] <= 0)
              throw new DomainError("Tidak ada gol lama untuk tim ini");
            m.goalBaseline[side]--;
          }
          m.goals.push(goal);
        }
      }
      const totals = recordedScore(m);
      if (totals.home > 999 || totals.away > 999)
        throw new DomainError("Skor maksimal 999");
      if (wasFinal) {
        // Reuse final-result validation and bracket propagation atomically.
        const updated = applyCommand(c, user, {
          type: "correct",
          version: c.version,
          matchId: m.id,
          matchVersion: m.version,
          homeScore: totals.home,
          awayScore: totals.away,
          homePenalty:
            command.homePenalty === undefined
              ? m.homePenalty
              : command.homePenalty,
          awayPenalty:
            command.awayPenalty === undefined
              ? m.awayPenalty
              : command.awayPenalty,
          confirm: true,
          reason,
        });
        const audit = updated.audit.at(-1)!;
        audit.event = type;
        audit.before = before;
        return updated;
      }
      m.homeScore = totals.home;
      m.awayScore = totals.away;
      m.status = "live";
      c.status = "in_progress";
    } else if (type === "match_status") {
      const status = z
        .enum(["live", "postponed", "cancelled", "scheduled"])
        .parse(command.status);
      const transitions: Record<MatchStatus, string[]> = {
        scheduled: ["live", "postponed", "cancelled"],
        live: ["postponed"],
        postponed: ["scheduled", "cancelled"],
        final: [],
        cancelled: role === "score_operator" ? [] : ["scheduled"],
      };
      if (!transitions[m.status].includes(status))
        throw new DomainError("Perubahan status tidak diizinkan");
      if (status === "live" && (!m.home || !m.away))
        throw new DomainError("Menunggu peserta dari babak sebelumnya");
      m.status = status;
      if (status === "live") c.status = "in_progress";
    } else {
      if (!m.home || !m.away) throw new DomainError("Peserta belum lengkap");
      if (type === "correct") {
        if (m.status !== "final")
          throw new DomainError("Hanya hasil final yang dapat dikoreksi");
        reason = z
          .string()
          .trim()
          .min(5, "Alasan koreksi minimal 5 karakter")
          .max(500)
          .parse(command.reason);
      } else if (!["scheduled", "live"].includes(m.status))
        throw new DomainError("Skor tidak dapat diubah pada status ini");
      const scores = z
        .object({
          homeScore: z.number().int().min(0).max(999),
          awayScore: z.number().int().min(0).max(999),
          homePenalty: z.number().int().min(0).max(999).nullable().optional(),
          awayPenalty: z.number().int().min(0).max(999).nullable().optional(),
        })
        .parse(command);
      if (m.goals !== undefined) {
        const totals = recordedScore(m);
        if (
          scores.homeScore !== totals.home ||
          scores.awayScore !== totals.away
        )
          throw new DomainError(
            "Ubah catatan gol untuk mengubah skor pertandingan ini",
          );
      }
      if (type === "score" && m.status !== "live")
        throw new DomainError("Mulai pertandingan live terlebih dahulu");
      if (type !== "score" && command.confirm !== true)
        throw new DomainError("Hasil final memerlukan konfirmasi");
      let winner: string | null = null;
      if (type !== "score" && m.stage === "knockout") {
        if (scores.homeScore !== scores.awayScore)
          winner = scores.homeScore > scores.awayScore ? m.home : m.away;
        else if (
          scores.homePenalty != null &&
          scores.awayPenalty != null &&
          scores.homePenalty !== scores.awayPenalty
        )
          winner = scores.homePenalty > scores.awayPenalty ? m.home : m.away;
        else
          throw new DomainError(
            "Skor seri di fase gugur membutuhkan hasil penalti yang menentukan pemenang",
          );
      }
      if (type === "correct" && winner !== m.winner) {
        const dependents = c.matches.filter(
          (x) => x.sourceHome === m.id || x.sourceAway === m.id,
        );
        if (
          dependents.some((x) => !["scheduled", "postponed"].includes(x.status))
        )
          throw new DomainError(
            "Koreksi diblokir: babak berikutnya sudah dimulai. Perlu resolusi administratif.",
          );
      }
      Object.assign(m, scores);
      if (type !== "score") {
        m.status = "final";
        m.winner = winner;
        for (const next of c.matches.filter(
          (x) => x.sourceHome === m.id || x.sourceAway === m.id,
        )) {
          const advancing =
            next.sourceOutcome === "loser"
              ? winner === m.home
                ? m.away
                : m.home
              : winner;
          if (next.sourceHome === m.id) next.home = advancing;
          if (next.sourceAway === m.id) next.away = advancing;
          next.version++;
        }
      }
      c.status = "in_progress";
    }
    m.version++;
    after = structuredClone(m);
  } else throw new DomainError("Tindakan tidak dikenal");
  c.version++;
  c.audit.push({
    id: id(),
    actor: user.guest ? `${user.name || "Panitia"} (tautan)` : user.email,
    event: type,
    reason,
    before,
    after,
    at: new Date().toISOString(),
  });
  return c;
}
