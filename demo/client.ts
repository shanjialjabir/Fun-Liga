import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createCompetition,
  applyCommand,
  canView,
  roleFor,
  DomainError,
  type Competition,
} from "../src/lib/competition";
import { z } from "zod";
export const authClient: SupabaseClient | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
type User = { id: string; email: string; name: string };
type Invite = {
  token_hash: string;
  competition_id: string;
  role: "admin" | "score_operator";
  email: string | null;
  expires_at: number;
  accepted_at: number | null;
};
type State = {
  competitions: Competition[];
  users: User[];
  activeUser: string | null;
  invites: Invite[];
};
const key = "fun-mini-soccer-browser-demo-v1";
const defaultUser: User = {
  id: crypto.randomUUID(),
  email: "demo@example.test",
  name: "Pemain Demo",
};
let fallback: State = {
  competitions: [],
  users: [defaultUser],
  activeUser: defaultUser.id,
  invites: [],
};
function read(): State {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(key, JSON.stringify(fallback));
  } catch {
    /* File browsers may block persistence; keep the demo usable in memory. */
  }
  return structuredClone(fallback);
}
function save(state: State) {
  fallback = structuredClone(state);
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    document.documentElement.dataset.persistence = "memory";
  }
}
function safe(c: Competition, user?: User) {
  return roleFor(c, user?.id)
    ? c
    : { ...c, ownerId: "", members: [], audit: [] };
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    const state = read();
    const user = state.users.find((u) => u.id === state.activeUser);
    const [route, query] = path.split("?");
    const parts = route.split("/");
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(String(options.body)) : {};
    let result: unknown;
    if (route === "session") {
      result = { user: user || null, demo: true };
    } else if (route === "demo-login") {
      const v = z
        .object({ email: z.email(), name: z.string().trim().min(1) })
        .parse(body);
      let account = state.users.find((u) => u.email === v.email);
      if (!account) {
        account = { id: crypto.randomUUID(), ...v };
        state.users.push(account);
      }
      state.activeUser = account.id;
      save(state);
      result = { user: account, demo: true };
    } else if (route === "logout") {
      state.activeUser = null;
      save(state);
      result = { ok: true };
    } else if (route === "competitions" && method === "GET") {
      const mine = new URLSearchParams(query).get("scope") === "mine";
      result = state.competitions
        .filter((c) =>
          mine
            ? roleFor(c, user?.id)
            : c.visibility === "public" && c.status !== "draft",
        )
        .map((c) => safe(c, user));
    } else if (route === "competitions" && method === "POST") {
      if (!user) throw new ApiError("Masuk terlebih dahulu", 401);
      const c = createCompetition(body, user);
      state.competitions.unshift(c);
      save(state);
      result = c;
    } else if (parts[0] === "competitions" && parts[1]) {
      const c = state.competitions.find(
        (c) => c.id === parts[1] || c.slug === parts[1],
      );
      if (!c || !canView(c, user?.id))
        throw new ApiError(
          "Kompetisi tidak ditemukan atau akses terbatas",
          404,
        );
      if (parts.length === 2 && method === "GET") result = safe(c, user);
      else {
        if (!user) throw new ApiError("Masuk terlebih dahulu", 401);
        const role = roleFor(c, user.id);
        if (parts[2] === "invites") {
          if (!role || role === "score_operator")
            throw new ApiError("Akses terbatas", 403);
          if (method === "GET")
            result = state.invites.filter((i) => i.competition_id === c.id);
          else if (method === "DELETE") {
            state.invites = state.invites.filter(
              (i) => i.competition_id !== c.id || i.token_hash !== body.hash,
            );
            save(state);
            result = { ok: true };
          } else {
            const v = z
              .object({
                role: z.enum(["admin", "score_operator"]),
                email: z.union([z.email(), z.literal("")]).optional(),
              })
              .parse(body);
            if (v.role === "admin" && role !== "owner")
              throw new ApiError("Hanya owner dapat mengundang admin", 403);
            const token = Array.from(
              crypto.getRandomValues(new Uint8Array(32)),
              (n) => n.toString(16).padStart(2, "0"),
            ).join("");
            state.invites.push({
              token_hash: token,
              competition_id: c.id,
              role: v.role,
              email: v.email || null,
              expires_at: Date.now() + 72 * 3600000,
              accepted_at: null,
            });
            save(state);
            result = { token };
          }
        } else if (method === "PATCH") {
          const updated = applyCommand(c, user, body);
          state.competitions = state.competitions.map((x) =>
            x.id === c.id ? updated : x,
          );
          save(state);
          result = updated;
        } else throw new ApiError("Tidak tersedia dalam demo", 404);
      }
    } else if (route === "invite" && method === "POST") {
      if (!user) throw new ApiError("Masuk terlebih dahulu", 401);
      const invite = state.invites.find((i) => i.token_hash === body.token);
      if (!invite || invite.accepted_at || invite.expires_at < Date.now())
        throw new ApiError("Undangan tidak valid atau kedaluwarsa", 400);
      if (invite.email && invite.email !== user.email)
        throw new ApiError("Email penerima berbeda", 403);
      const c = state.competitions.find((c) => c.id === invite.competition_id)!;
      if (c.members.some((m) => m.userId === user.id))
        throw new ApiError("Anda sudah menjadi anggota", 400);
      c.members.push({ userId: user.id, email: user.email, role: invite.role });
      c.version++;
      invite.accepted_at = Date.now();
      save(state);
      result = c;
    } else throw new ApiError("Halaman tidak ditemukan", 404);
    return structuredClone(result) as T;
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new ApiError(error.issues.map((i) => i.message).join(". "), 400);
    if (error instanceof DomainError)
      throw new ApiError(error.message, error.status);
    throw error;
  }
}
