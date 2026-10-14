import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Competition } from "./competition";
import { DomainError } from "./competition";
import { isMainAdmin, hasAppAccess } from "./access";

export const demoMode =
  process.env.DEMO_MODE === "true" ||
  (process.env.NODE_ENV !== "production" &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL);
let database: DatabaseSync | undefined;
function db() {
  if (!demoMode) throw new DomainError("Mode demo dinonaktifkan", 403);
  if (!database) {
    const dir = process.env.DEMO_DATA_DIR || path.join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true });
    database = new DatabaseSync(path.join(dir, "demo.sqlite"));
    database.exec(
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS competitions(id TEXT PRIMARY KEY,version INTEGER NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS invites(token_hash TEXT PRIMARY KEY,competition_id TEXT NOT NULL,role TEXT NOT NULL,email TEXT,expires_at INTEGER NOT NULL,accepted_at INTEGER);`,
    );
  }
  return database;
}
function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY_SERVER_ONLY;
  if (!url || !key)
    throw new DomainError(
      "Supabase belum dikonfigurasi. Isi environment variables dan jalankan migrasi.",
      503,
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export type User = {
  id: string;
  email: string;
  name: string;
  guest?: boolean;
  competitionId?: string;
  competitionName?: string;
  role?: "admin" | "score_operator";
  expiresAt?: number;
};
export async function currentUser(request: Request): Promise<User | null> {
  const guestToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("fms_committee="))
    ?.slice(14);
  if (guestToken) {
    const access = await findCommitteeAccess(guestToken);
    if (access) return access.user;
  }
  if (demoMode) {
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("fms_session="))
      ?.slice(12);
    if (!token) return null;
    const row = db()
      .prepare(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
      )
      .get(hash(token), Date.now()) as User | undefined;
    return row ?? null;
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const { data, error } = await supabase().auth.getUser(authorization.slice(7));
  if (error || !data.user) return null;
  if (!hasAppAccess(data.user)) return null;
  return {
    id: data.user.id,
    email: data.user.email || "",
    name:
      data.user.user_metadata.display_name ||
      data.user.email?.split("@")[0] ||
      "Panitia",
  };
}
export function demoLogin(email: string, name: string) {
  const database = db();
  let user = database
    .prepare("SELECT * FROM users WHERE email=?")
    .get(email) as User | undefined;
  if (!user) {
    user = { id: crypto.randomUUID(), email, name };
    database
      .prepare("INSERT INTO users VALUES(?,?,?)")
      .run(user.id, email, name);
  }
  const token = randomBytes(32).toString("hex");
  database
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(hash(token), user.id, Date.now() + 7 * 86400000);
  return { user, token };
}
export function demoLogout(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("fms_session="))
    ?.slice(12);
  if (token)
    db().prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token));
}
export async function getCompetitions(): Promise<Competition[]> {
  if (demoMode)
    return (
      db()
        .prepare("SELECT data FROM competitions ORDER BY rowid DESC")
        .all() as { data: string }[]
    ).map((r) => JSON.parse(r.data));
  const { data, error } = await supabase()
    .from("competitions")
    .select("data")
    .order("created_at", { ascending: false });
  if (error)
    throw new DomainError(
      "Database tidak dapat diakses. Periksa migrasi dan konfigurasi.",
      503,
    );
  return (data || []).map((r) => r.data as Competition);
}
export async function getCompetition(id: string) {
  if (demoMode) {
    const row = db()
      .prepare("SELECT data FROM competitions WHERE id=?")
      .get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Competition) : null;
  }
  const { data, error } = await supabase()
    .from("competitions")
    .select("data")
    .eq(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
        ? "id"
        : "slug",
      id,
    )
    .maybeSingle();
  if (error) throw new DomainError("Gagal membaca kompetisi", 503);
  return data?.data as Competition | null;
}
export async function bySlug(slug: string) {
  return (await getCompetitions()).find((c) => c.slug === slug) || null;
}
export async function saveCompetition(
  c: Competition,
  previousVersion?: number,
) {
  if (demoMode) {
    if (previousVersion == null)
      db()
        .prepare("INSERT INTO competitions VALUES(?,?,?)")
        .run(c.id, c.version, JSON.stringify(c));
    else {
      const result = db()
        .prepare(
          "UPDATE competitions SET version=?,data=? WHERE id=? AND version=?",
        )
        .run(c.version, JSON.stringify(c), c.id, previousVersion);
      if (!result.changes)
        throw new DomainError(
          "Konflik penyimpanan. Muat ulang data terbaru.",
          409,
        );
    }
    return;
  }
  const { error } = await supabase().rpc("save_competition", {
    payload: c,
    expected_version: previousVersion ?? null,
  });
  if (error)
    throw new DomainError(
      error.message.includes("conflict")
        ? "Konflik penyimpanan. Muat ulang."
        : "Gagal menyimpan kompetisi",
      error.message.includes("conflict") ? 409 : 503,
    );
}
export async function deleteCompetition(
  id: string,
  ownerId: string,
  version: number,
  name: string,
) {
  if (demoMode) {
    const database = db();
    database.exec("BEGIN IMMEDIATE");
    try {
      const result = database
        .prepare(
          "DELETE FROM competitions WHERE id=? AND version=? AND json_extract(data,'$.ownerId')=? AND json_extract(data,'$.name')=?",
        )
        .run(id, version, ownerId, name);
      if (!result.changes)
        throw new DomainError(
          "Data kompetisi berubah. Muat ulang sebelum menghapus.",
          409,
        );
      database.prepare("DELETE FROM invites WHERE competition_id=?").run(id);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    return;
  }
  // Owner, version and confirmation are checked in the same atomic deletion.
  // Foreign keys also delete memberships, invitations and realtime events.
  const { data, error } = await supabase()
    .from("competitions")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", ownerId)
    .eq("version", version)
    .eq("data->>name", name)
    .select("id")
    .maybeSingle();
  if (error)
    throw new DomainError("Gagal menghapus kompetisi. Silakan coba lagi.", 503);
  if (!data)
    throw new DomainError(
      "Data kompetisi berubah. Muat ulang sebelum menghapus.",
      409,
    );
}

export async function findCommitteeAccess(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = hash(token);
  let c: Competition | null;
  if (demoMode) {
    const row = db()
      .prepare(
        "SELECT data FROM competitions WHERE EXISTS (SELECT 1 FROM json_each(competitions.data,'$.committeeLinks') WHERE json_extract(value,'$.tokenHash')=?) LIMIT 1",
      )
      .get(tokenHash) as { data: string } | undefined;
    c = row ? JSON.parse(row.data) : null;
  } else {
    const { data, error } = await supabase()
      .from("competitions")
      .select("data")
      .contains("data", { committeeLinks: [{ tokenHash }] })
      .maybeSingle();
    if (error) throw new DomainError("Gagal memeriksa akses panitia", 503);
    c = data?.data ?? null;
  }
  const link = c?.committeeLinks?.find(
    (link) => link.tokenHash === tokenHash && link.expiresAt > Date.now(),
  );
  if (!c || !link) return null;
  return {
    competition: c,
    link,
    user: {
      id: `link:${link.id}`,
      email: `link-${link.id}@panitia.invalid`,
      name: link.label,
      guest: true as const,
      competitionId: c.id,
      competitionName: c.name,
      role: link.role,
      expiresAt: link.expiresAt,
    },
  };
}
export async function createCommitteeLink(
  c: Competition,
  user: User,
  role: "admin" | "score_operator",
  label: string,
) {
  const token = randomBytes(32).toString("hex");
  const link = {
    id: crypto.randomUUID(),
    tokenHash: hash(token),
    role,
    label:
      label ||
      (role === "admin"
        ? "Admin melalui tautan"
        : "Operator skor melalui tautan"),
    expiresAt: Date.now() + 72 * 3600000,
  };
  const updated = structuredClone(c);
  updated.committeeLinks ??= [];
  updated.committeeLinks.push(link);
  updated.version++;
  updated.audit.push({
    id: crypto.randomUUID(),
    actor: user.guest ? `${user.name} (tautan)` : user.email,
    event: "committee_link_created",
    reason: null,
    before: null,
    after: {
      id: link.id,
      role: link.role,
      label: link.label,
      expiresAt: link.expiresAt,
    },
    at: new Date().toISOString(),
  });
  await saveCompetition(updated, c.version);
  return { token, expiresAt: link.expiresAt };
}
export async function openCommitteeLink(token: string) {
  const existing = await findCommitteeAccess(token);
  if (existing) return existing;
  // Unused legacy invitations retain their original expiration but now allow account-free access.
  const tokenHash = hash(token);
  let invite:
    | {
        competition_id: string;
        role: "admin" | "score_operator";
        email: string | null;
        expires_at: number;
        accepted_at: number | null;
      }
    | undefined;
  if (demoMode)
    invite = db()
      .prepare("SELECT * FROM invites WHERE token_hash=?")
      .get(tokenHash) as typeof invite;
  else {
    const { data, error } = await supabase()
      .from("competition_invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw new DomainError("Gagal membaca undangan", 503);
    invite = data ?? undefined;
  }
  if (!invite || invite.accepted_at || Number(invite.expires_at) <= Date.now())
    throw new DomainError(
      "Tautan panitia tidak valid, sudah dicabut, atau kedaluwarsa",
      403,
    );
  const c = await getCompetition(invite.competition_id);
  if (!c) throw new DomainError("Kompetisi tidak ditemukan", 404);
  const previous = c.version;
  const link = {
    id: crypto.randomUUID(),
    tokenHash,
    role: invite.role,
    label:
      invite.role === "admin"
        ? "Admin melalui tautan"
        : "Operator skor melalui tautan",
    expiresAt: Number(invite.expires_at),
  };
  c.committeeLinks ??= [];
  c.committeeLinks.push(link);
  c.version++;
  c.audit.push({
    id: crypto.randomUUID(),
    actor: "Tautan panitia",
    event: "committee_link_activated",
    reason: null,
    before: null,
    after: { id: link.id, role: link.role, expiresAt: link.expiresAt },
    at: new Date().toISOString(),
  });
  try {
    if (demoMode) {
      const database = db();
      database.exec("BEGIN IMMEDIATE");
      try {
        const consumed = database
          .prepare(
            "UPDATE invites SET accepted_at=? WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?",
          )
          .run(Date.now(), tokenHash, Date.now());
        if (!consumed.changes)
          throw new DomainError("Undangan telah berubah", 409);
        const saved = database
          .prepare(
            "UPDATE competitions SET version=?,data=? WHERE id=? AND version=?",
          )
          .run(c.version, JSON.stringify(c), c.id, previous);
        if (!saved.changes) throw new DomainError("Konflik penyimpanan", 409);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    } else {
      const { error } = await supabase().rpc("accept_competition_invite", {
        payload: c,
        expected_version: previous,
        invite_hash: tokenHash,
      });
      if (error)
        throw new DomainError(
          "Undangan telah berubah. Buka tautan kembali.",
          409,
        );
    }
  } catch (error) {
    const concurrent = await findCommitteeAccess(token);
    if (concurrent) return concurrent;
    throw error;
  }
  const result = await findCommitteeAccess(token);
  if (!result) throw new DomainError("Akses panitia tidak tersedia", 403);
  return result;
}

export async function createInvite(
  competitionId: string,
  role: "admin" | "score_operator",
  email: string | null,
) {
  const token = randomBytes(32).toString("hex");
  const invite = {
    token_hash: hash(token),
    competition_id: competitionId,
    role,
    email,
    expires_at: Date.now() + 72 * 3600000,
    accepted_at: null,
  };
  if (demoMode)
    db()
      .prepare("INSERT INTO invites VALUES(?,?,?,?,?,?)")
      .run(
        invite.token_hash,
        competitionId,
        role,
        email,
        invite.expires_at,
        null,
      );
  else {
    const { error } = await supabase()
      .from("competition_invites")
      .insert(invite);
    if (error) throw new DomainError("Gagal membuat undangan", 503);
  }
  return token;
}
export async function acceptInvite(token: string, user: User) {
  const tokenHash = hash(token);
  let invite:
    | {
        competition_id: string;
        role: "admin" | "score_operator";
        email: string | null;
        expires_at: number;
        accepted_at: number | null;
      }
    | undefined;
  if (demoMode)
    invite = db()
      .prepare("SELECT * FROM invites WHERE token_hash=?")
      .get(tokenHash) as typeof invite;
  else {
    const { data, error } = await supabase()
      .from("competition_invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw new DomainError("Gagal membaca undangan", 503);
    invite = data;
  }
  if (!invite || invite.accepted_at || Number(invite.expires_at) < Date.now())
    throw new DomainError("Undangan tidak valid atau kedaluwarsa");
  if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase())
    throw new DomainError("Undangan ditujukan untuk email lain", 403);
  const c = await getCompetition(invite.competition_id);
  if (!c) throw new DomainError("Kompetisi tidak ditemukan", 404);
  if (c.members.some((m) => m.userId === user.id))
    throw new DomainError("Anda sudah menjadi anggota");
  const previous = c.version;
  c.members.push({ userId: user.id, email: user.email, role: invite.role });
  c.version++;
  c.audit.push({
    id: crypto.randomUUID(),
    actor: user.email,
    event: "invite_accepted",
    reason: null,
    before: null,
    after: invite.role,
    at: new Date().toISOString(),
  });
  if (demoMode) {
    const database = db();
    database.exec("BEGIN IMMEDIATE");
    try {
      const fresh = database
        .prepare("SELECT accepted_at FROM invites WHERE token_hash=?")
        .get(tokenHash) as { accepted_at: number | null };
      if (fresh.accepted_at) throw new DomainError("Undangan telah dipakai");
      const r = database
        .prepare(
          "UPDATE competitions SET version=?,data=? WHERE id=? AND version=?",
        )
        .run(c.version, JSON.stringify(c), c.id, previous);
      if (!r.changes) throw new DomainError("Konflik penyimpanan", 409);
      database
        .prepare("UPDATE invites SET accepted_at=? WHERE token_hash=?")
        .run(Date.now(), tokenHash);
      database.exec("COMMIT");
    } catch (e) {
      database.exec("ROLLBACK");
      throw e;
    }
  } else {
    const { error } = await supabase().rpc("accept_competition_invite", {
      payload: c,
      expected_version: previous,
      invite_hash: tokenHash,
    });
    if (error)
      throw new DomainError(
        "Undangan gagal diterima atau sudah digunakan",
        409,
      );
  }
  return c;
}
export async function listInvites(cid: string) {
  if (demoMode)
    return db()
      .prepare(
        "SELECT token_hash,role,email,expires_at,accepted_at FROM invites WHERE competition_id=?",
      )
      .all(cid);
  const { data, error } = await supabase()
    .from("competition_invites")
    .select("token_hash,role,email,expires_at,accepted_at")
    .eq("competition_id", cid);
  if (error) throw new DomainError("Gagal memuat undangan", 503);
  return data;
}
export async function revokeInvite(cid: string, tokenHash: string) {
  if (demoMode)
    db()
      .prepare("DELETE FROM invites WHERE competition_id=? AND token_hash=?")
      .run(cid, tokenHash);
  else {
    const { error } = await supabase()
      .from("competition_invites")
      .delete()
      .eq("competition_id", cid)
      .eq("token_hash", tokenHash);
    if (error) throw new DomainError("Gagal mencabut undangan", 503);
  }
}

export async function listManagedAccounts() {
  if (demoMode)
    return db()
      .prepare("SELECT id,email,name FROM users ORDER BY name")
      .all() as unknown as User[];
  const client = supabase();
  const accounts: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new DomainError("Gagal membaca akun", 503);
    for (const user of data.users) {
      if (isMainAdmin(user.email) || user.app_metadata.fun_liga_access === true)
        accounts.push({
          id: user.id,
          email: user.email || "",
          name:
            user.user_metadata.display_name ||
            user.email?.split("@")[0] ||
            "Panitia",
        });
    }
    if (data.users.length < 200) break;
  }
  return accounts;
}
export async function createManagedAccount(
  email: string,
  name: string,
  password: string,
) {
  if (demoMode) {
    const existing = db()
      .prepare("SELECT * FROM users WHERE email=?")
      .get(email) as User | undefined;
    if (existing) return { user: existing, created: false };
    const user = { id: crypto.randomUUID(), email, name };
    db().prepare("INSERT INTO users VALUES(?,?,?)").run(user.id, email, name);
    return { user, created: true };
  }
  const client = supabase();
  // Preserve credentials and verification belonging to the shared Auth project.
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new DomainError("Gagal memeriksa akun", 503);
    const existing = data.users.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      const result = await client.auth.admin.updateUserById(existing.id, {
        app_metadata: { ...existing.app_metadata, fun_liga_access: true },
      });
      if (result.error) throw new DomainError("Gagal memberi akses akun", 503);
      return {
        user: {
          id: existing.id,
          email,
          name: existing.user_metadata.display_name || name,
        },
        created: false,
      };
    }
    if (data.users.length < 200) break;
  }
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
    app_metadata: { fun_liga_access: true },
  });
  if (error || !data.user)
    throw new DomainError(
      "Gagal membuat akun. Periksa email dan kata sandi.",
      400,
    );
  return { user: { id: data.user.id, email, name }, created: true };
}
