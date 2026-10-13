import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCompetition,
  applyCommand,
  canView,
  roleFor,
  DomainError,
  type Competition,
} from "@/lib/competition";
import {
  currentUser,
  demoMode,
  demoLogin,
  demoLogout,
  getCompetitions,
  getCompetition,
  bySlug,
  saveCompetition,
  deleteCompetition,
  createInvite,
  acceptInvite,
  listInvites,
  revokeInvite,
} from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function safe(c: Competition, userId?: string) {
  if (roleFor(c, userId)) return c;
  return { ...c, ownerId: "", members: [], audit: [] };
}
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    const user = await currentUser(request);
    const method = request.method;
    const url = new URL(request.url);
    if (method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && new URL(origin).host !== request.headers.get("host"))
        throw new DomainError("Origin tidak diizinkan", 403);
      if (!request.headers.get("content-type")?.includes("application/json"))
        throw new DomainError("Content-Type harus application/json", 415);
      if (Number(request.headers.get("content-length") || 0) > 512000)
        throw new DomainError("Permintaan terlalu besar", 413);
    }
    if (path[0] === "session" && method === "GET")
      return NextResponse.json({ user, demo: demoMode });
    if (path[0] === "demo-login" && method === "POST") {
      if (!demoMode) throw new DomainError("Mode demo dinonaktifkan", 403);
      const input = z
        .object({
          email: z.email().max(200),
          name: z.string().trim().min(1).max(80),
        })
        .parse(await request.json());
      const result = demoLogin(input.email.toLowerCase(), input.name);
      const response = NextResponse.json({ user: result.user, demo: true });
      response.cookies.set("fms_session", result.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        maxAge: 604800,
        path: "/",
      });
      return response;
    }
    if (path[0] === "logout" && method === "POST") {
      if (demoMode) demoLogout(request);
      const response = NextResponse.json({ ok: true });
      response.cookies.delete("fms_session");
      return response;
    }
    if (path[0] === "competitions" && path.length === 1 && method === "GET") {
      let cs = await getCompetitions();
      const scope = url.searchParams.get("scope");
      cs =
        scope === "mine"
          ? cs.filter((c) => roleFor(c, user?.id))
          : cs.filter((c) => c.visibility === "public" && c.status !== "draft");
      return NextResponse.json(cs.map((c) => safe(c, user?.id)));
    }
    if (path[0] === "competitions" && path.length === 1 && method === "POST") {
      if (!user) throw new DomainError("Silakan masuk terlebih dahulu", 401);
      const c = createCompetition(await request.json(), user);
      await saveCompetition(c);
      return NextResponse.json(c, { status: 201 });
    }
    if (path[0] === "invite" && method === "POST") {
      if (!user) throw new DomainError("Masuk terlebih dahulu", 401);
      const { token } = z
        .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(await request.json());
      return NextResponse.json(await acceptInvite(token, user));
    }
    if (path[0] === "competitions" && path[1]) {
      const c = (await getCompetition(path[1])) || (await bySlug(path[1]));
      if (!c || !canView(c, user?.id))
        throw new DomainError(
          "Kompetisi tidak ditemukan atau akses terbatas",
          404,
        );
      if (path.length === 2 && method === "GET")
        return NextResponse.json(safe(c, user?.id));
      if (!user) throw new DomainError("Silakan masuk terlebih dahulu", 401);
      if (path.length === 2 && method === "DELETE") {
        if (roleFor(c, user.id) !== "owner")
          throw new DomainError("Hanya pemilik dapat menghapus kompetisi", 403);
        const input = z
          .object({
            name: z.string().min(1).max(100),
            version: z.number().int().nonnegative(),
          })
          .parse(await request.json());
        if (input.version !== c.version)
          throw new DomainError(
            "Data kompetisi berubah. Muat ulang sebelum menghapus.",
            409,
          );
        if (input.name !== c.name)
          throw new DomainError(
            "Nama konfirmasi harus sama dengan nama kompetisi",
            400,
          );
        await deleteCompetition(c.id, user.id, input.version, input.name);
        return NextResponse.json({ ok: true });
      }
      if (path[2] === "invites") {
        const role = roleFor(c, user.id);
        if (!role || role === "score_operator")
          throw new DomainError("Akses terbatas", 403);
        if (method === "GET") return NextResponse.json(await listInvites(c.id));
        if (method === "DELETE") {
          const { hash } = z
            .object({ hash: z.string() })
            .parse(await request.json());
          await revokeInvite(c.id, hash);
          return NextResponse.json({ ok: true });
        }
        if (method === "POST") {
          const v = z
            .object({
              role: z.enum(["admin", "score_operator"]),
              email: z.union([z.email(), z.literal("")]).optional(),
            })
            .parse(await request.json());
          if (v.role === "admin" && role !== "owner")
            throw new DomainError("Hanya owner dapat mengundang admin", 403);
          const token = await createInvite(c.id, v.role, v.email || null);
          return NextResponse.json({ token, expiresHours: 72 });
        }
      }
      if (path.length === 2 && method === "PATCH") {
        const data = await request.json();
        const updated = applyCommand(c, user, data);
        await saveCompetition(updated, c.version);
        return NextResponse.json(updated);
      }
    }
    throw new DomainError("Endpoint tidak ditemukan", 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(". ") },
        { status: 400 },
      );
    if (error instanceof DomainError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(
      "Request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Terjadi kesalahan server. Silakan coba lagi." },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
