"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Flag,
  Globe2,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Radio,
  Search,
  Settings2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Shuffle,
  Swords,
  Trophy,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  Zap,
  X,
} from "lucide-react";
import { api, authClient, ApiError } from "@/lib/client";
import { ACCENT_COLOR } from "@/lib/palette";
import { isMainAdmin } from "@/lib/access";
import {
  competitionInput,
  formats,
  standings,
  restWarnings,
  generateFixtures,
  shuffleSchedule,
  canShuffleSchedule,
  roleFor,
  type Competition,
  type Format,
  type Match,
  type Role,
} from "@/lib/competition";
import { Modal, Badge, TeamMark, Empty, Loading } from "./ui";
import { MatchGoals, GoalTimeline, PlayerLeaders } from "./match-goals";

type User = { id: string; email: string; name: string };
const formatIcons = {
  fourfeo: Zap,
  league: Trophy,
  group_stage: Users,
  knockout: Swords,
  group_then_knockout: Flag,
};
const date = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
const time = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
const memberLabels: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  score_operator: "Operator skor",
};
export function SoccerApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<
    "login" | "signup" | "reset" | "password"
  >("login");
  const [notice, setNotice] = useState("");
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(media.matches);
    queueMicrotask(update);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!menu || !mobile) return;
    const sidebar = document.querySelector<HTMLElement>(".sidebar")!;
    const previous = document.activeElement as HTMLElement;
    const targets = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>("a[href],button:not(:disabled)"),
      ).filter((el) => el.offsetWidth > 0);
    targets()[0]?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        return;
      }
      if (e.key === "Tab") {
        const list = targets(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [menu, mobile]);
  const [sessionError, setSessionError] = useState("");
  const refreshSession = useCallback(async () => {
    try {
      const s = await api<{ user: User | null; demo: boolean }>("session");
      setUser(s.user);
      setDemo(s.demo);
      setSessionError("");
    } catch (e) {
      setSessionError((e as Error).message);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refreshSession);
    const { data } = authClient?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("password");
        setAuthOpen(true);
      }
      window.setTimeout(() => void refreshSession(), 0);
    }) || { data: undefined };
    return () => data?.subscription.unsubscribe();
  }, [refreshSession]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  const requireLogin = () => {
    setAuthMode("login");
    setAuthOpen(true);
  };
  const navigate = (url: string) => {
    setMenu(false);
    router.push(url);
  };
  const logout = async () => {
    try {
      if (authClient) await authClient.auth.signOut();
      await api("logout", { method: "POST", body: "{}" });
      setUser(null);
      router.push("/");
      setNotice("Anda telah keluar");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const parts = pathname.split("/").filter(Boolean);
  const competitionRoute =
    parts[0] === "c" ||
    (parts[0] === "dashboard" && parts[1] === "competitions" && !!parts[2]);
  const cId = parts[0] === "c" ? parts[1] : parts[2];
  const cTab = parts[0] === "c" ? parts[2] : parts[3];
  const isAdminRoute = parts[0] === "dashboard" && competitionRoute;
  const navigation = [
    { href: "/", label: "Beranda", icon: LayoutDashboard },
    { href: "/explore", label: "Jelajahi kompetisi", icon: Globe2 },
    { href: "/dashboard", label: "Kompetisi saya", icon: Trophy },
  ];
  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${menu ? "is-open" : ""}`}
        inert={mobile && !menu}
        role={mobile && menu ? "dialog" : undefined}
        aria-modal={mobile && menu ? true : undefined}
        aria-label="Navigasi utama"
      >
        <button
          className="icon-button sidebar-close"
          aria-label="Tutup navigasi"
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Swords size={25} />
          </span>
          <span>
            FUN<span className="brand-small">MINI SOCCER</span>
          </span>
        </Link>
        <div className="sidebar-label">YOUR GAME. YOUR RULES.</div>
        <nav>
          {navigation.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenu(false)}
              className={`nav-item ${pathname === n.href || (n.href === "/dashboard" && pathname.startsWith("/dashboard")) ? "active" : ""}`}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.href === "/explore" && <span className="nav-new">NEW</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-create">
          <div className="tiny-pitch">
            <span />
            <Swords size={23} />
          </div>
          <h3>Mulai cerita di lapangan.</h3>
          <p>Satu kompetisi. Banyak momen tak terlupakan.</p>
          <button
            className="button primary"
            onClick={() => (user ? navigate("/dashboard/new") : requireLogin())}
          >
            <Plus size={17} /> Buat kompetisi
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => navigate("/help")}>
            <CircleHelp size={19} /> Pusat bantuan <ArrowUpRight size={15} />
          </button>
          <div className="sidebar-footer">
            <span className="status-dot" /> Every Match Matters.
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-scrim"
          aria-label="Tutup menu"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell" inert={mobile && menu}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Buka navigasi"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} />{" "}
              <b>
                {competitionRoute
                  ? "Kompetisi"
                  : parts[0] === "explore"
                    ? "Jelajahi"
                    : parts[0] === "dashboard"
                      ? "Kompetisi saya"
                      : "Beranda"}
              </b>
            </span>
          </div>
          <div className="topbar-right">
            {demo && (
              <span className="demo-tag">
                <span /> DEMO LOKAL
              </span>
            )}
            <span className="top-date">{date(new Date().toISOString())}</span>
            <span className="top-divider" />
            {user ? (
              <button
                className="profile-button"
                onClick={() => navigate("/account")}
              >
                <span className="avatar">
                  {user.name?.slice(0, 1).toUpperCase() || "P"}
                </span>
                <span>{user.name || "Panitia"}</span>
                <ChevronDown size={14} />
              </button>
            ) : (
              <button className="button small secondary" onClick={requireLogin}>
                Masuk <ArrowRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main>
          {sessionError ? (
            <div className="alert error">
              {sessionError}{" "}
              <button onClick={() => void refreshSession()}>Coba lagi</button>
            </div>
          ) : !ready ? (
            <Loading />
          ) : competitionRoute ? (
            <CompetitionView
              key={cId}
              id={cId}
              tab={cTab || "overview"}
              matchId={parts[4]}
              user={user}
              demo={demo}
              adminRoute={isAdminRoute}
              notify={setNotice}
            />
          ) : parts[0] === "dashboard" && parts[1] === "new" ? (
            user ? (
              <CreateCompetition user={user} notify={setNotice} />
            ) : (
              <SignInEmpty login={requireLogin} />
            )
          ) : parts[0] === "explore" || parts[0] === "dashboard" ? (
            <CompetitionList
              mine={parts[0] === "dashboard"}
              user={user}
              login={requireLogin}
            />
          ) : parts[0] === "account" ? (
            <Account
              user={user}
              demo={demo}
              login={requireLogin}
              logout={logout}
            />
          ) : parts[0] === "invite" ? (
            <InviteAccept
              token={parts[1]}
              user={user}
              login={requireLogin}
              notify={setNotice}
            />
          ) : parts[0] === "help" ? (
            <Help />
          ) : (
            <Home user={user} demo={demo} login={requireLogin} />
          )}
        </main>
        <footer className="page-footer">
          <span>© {new Date().getFullYear()} Fun Mini Soccer</span>
          <span>
            Made for the love of the game.{" "}
            <span className="footer-ball">◉</span>
          </span>
        </footer>
      </div>
      <nav className="bottom-nav" inert={mobile && menu}>
        {navigation.map((n) => (
          <Link
            href={n.href}
            key={n.href}
            className={pathname === n.href ? "active" : ""}
          >
            <n.icon size={19} />
            <span>
              {n.label
                .replace(" kompetisi", "")
                .replace("Kompetisi saya", "Kompetisi")}
            </span>
          </Link>
        ))}
        <button onClick={() => (user ? navigate("/account") : requireLogin())}>
          <Users size={19} />
          <span>Akun</span>
        </button>
      </nav>
      <AuthDialog
        open={authOpen}
        mode={authMode}
        setMode={setAuthMode}
        demo={demo}
        close={() => setAuthOpen(false)}
        done={async () => {
          await refreshSession();
          setAuthOpen(false);
          setNotice("Selamat datang di lapangan Anda");
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
    </div>
  );
}
function PitchArt() {
  return (
    <div className="pitch-art" aria-hidden="true">
      <div className="pitch-noise" />
      <div className="pitch-orbit orbit-one" />
      <div className="pitch-orbit orbit-two" />
      <div className="pitch-board">
        <div className="pitch-line" />
        <div className="pitch-center" />
        <div className="pitch-circle" />
        <div className="pitch-goal goal-top" />
        <div className="pitch-goal goal-bottom" />
        <span className="player p1">7</span>
        <span className="player p2">10</span>
        <span className="player p3">4</span>
        <span className="player p4">9</span>
        <span className="pitch-ball">✦</span>
      </div>
      <div className="art-label">
        <span className="status-dot" /> BUILT FOR YOUR NEXT KICKOFF
      </div>
      <div className="art-coordinates">6°12′ S · 106°49′ E</div>
      <div className="floating-label">
        <Trophy size={17} />
        <span>
          Small pitch.
          <br />
          <b>Big moments.</b>
        </span>
      </div>
    </div>
  );
}
function Home({
  user,
  demo,
  login,
}: {
  user: User | null;
  demo: boolean;
  login: () => void;
}) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Competition[]>("competitions")
      .then(setCompetitions)
      .catch((e) => setError(e.message));
  }, []);
  const router = useRouter();
  const start = () => (user ? router.push("/dashboard/new") : login());
  return (
    <div className="home page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> THE GAME STARTS HERE
          </div>
          <h1>
            {user
              ? `Halo, ${user.name.split(" ")[0]}.`
              : "Selamat datang di lapangan."}
            <span className="heading-dot"> </span>
          </h1>
          <p>Kompetisi lebih rapi. Fokus ke permainan.</p>
        </div>
        <span className="heading-tag">
          <Radio size={15} /> YOUR MATCHDAY, SIMPLIFIED
        </span>
      </div>
      <section className="hero">
        <div className="hero-content">
          <span className="hero-kicker">
            <span className="mini-line" /> EVERY MATCH MATTERS.
          </span>
          <h2>
            Kompetisi Anda.
            <br />
            Permainan <em>kita.</em>
          </h2>
          <p>
            Dari kick-off pertama sampai peluit terakhir.
            <br className="desktop-break" /> Kelola jadwal, skor, dan klasemen
            dalam satu tempat.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={start}>
              <Plus size={18} /> Buat kompetisi <ArrowUpRight size={18} />
            </button>
            <Link className="hero-link" href="/explore">
              Jelajahi kompetisi <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero-bottom">
            <span>
              <Check size={13} /> Gratis untuk memulai
            </span>
            <span>
              <Check size={13} /> Bagikan ke siapa saja
            </span>
          </div>
        </div>
        <PitchArt />
      </section>
      <div className="feature-strip">
        {[
          {
            icon: CalendarDays,
            title: "Jadwal otomatis",
            text: "Lebih sedikit atur. Lebih banyak main.",
          },
          {
            icon: Activity,
            title: "Skor & hasil pertandingan",
            text: "Setiap gol, setiap momen, tercatat.",
          },
          {
            icon: ListOrdered,
            title: "Klasemen yang akurat",
            text: "Dihitung dari hasil final, bukan perkiraan.",
          },
        ].map((f) => (
          <div key={f.title}>
            <span className="feature-icon">
              <f.icon size={21} />
            </span>
            <div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          </div>
        ))}
      </div>
      <section className="format-section">
        <div className="section-heading">
          <div>
            <h2>Pilih format. Mulai bermain.</h2>
            <p>Satu sore santai atau satu musim penuh. Semua punya tempat.</p>
          </div>
          <span className="muted">01 — 05</span>
        </div>
        <div className="format-grid">
          {Object.entries(formats).map(([key, label], i) => {
            const Icon = formatIcons[key as Format];
            return (
              <button
                key={key}
                className="format-card"
                onClick={() =>
                  user ? router.push(`/dashboard/new?format=${key}`) : login()
                }
              >
                <div className="format-card-top">
                  <Icon size={23} />
                  <span>0{i + 1}</span>
                </div>
                <h3>
                  {label}
                  {key === "fourfeo" && (
                    <span className="popular">POPULAR</span>
                  )}
                </h3>
                <p>
                  {
                    [
                      "4 tim. Satu lapangan. Banyak cerita.",
                      "Semua bertemu, semua punya peluang.",
                      "Persaingan seru di setiap grup.",
                      "Menang dan melangkah lebih jauh.",
                      "Dari penyisihan menuju juara.",
                    ][i]
                  }
                </p>
                <span className="format-action">
                  Mulai kompetisi <ArrowUpRight size={16} />
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <h2>Di sekitar lapangan</h2>
            <p>Kompetisi publik, terbuka untuk diikuti perkembangannya.</p>
          </div>
          <Link href="/explore" className="text-link">
            Lihat semua <ArrowRight size={16} />
          </Link>
        </div>
        {error ? (
          <div className="alert error">{error}</div>
        ) : competitions.length ? (
          <div className="competition-grid">
            {competitions.slice(0, 3).map((c) => (
              <CompetitionCard c={c} key={c.id} />
            ))}
          </div>
        ) : (
          <div className="discovery-empty">
            <div>
              <span className="outline-ball">
                <Globe2 size={28} />
              </span>
              <h3>Lapangan menunggu cerita pertama.</h3>
              <p>Kompetisi yang dipublikasikan akan muncul di sini.</p>
            </div>
            <button className="button secondary" onClick={start}>
              Buat kompetisi pertama <ArrowUpRight size={16} />
            </button>
          </div>
        )}
      </section>
      {demo && (
        <div className="demo-note">
          <Sparkles size={17} />
          <p>
            <b>Ini ruang demo lokal Anda.</b> Data tersimpan di database SQLite.
            Buat kompetisi sendiri untuk mencoba seluruh alur tanpa akun
            Supabase.
          </p>
          <Link href="/help">
            Pelajari <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
function CompetitionCard({
  c,
  mine = false,
}: {
  c: Competition;
  mine?: boolean;
}) {
  const Icon = formatIcons[c.format];
  const done = c.matches.filter((m) => m.status === "final").length;
  return (
    <Link
      href={mine ? `/dashboard/competitions/${c.id}` : `/c/${c.slug}`}
      className="competition-card"
    >
      <div className="competition-card-top">
        <span className="competition-icon">
          <Icon size={24} />
        </span>
        <Badge status={c.status} />
      </div>
      <span className="card-format">
        {formats[c.format]} <span>·</span> {c.teams.length} tim
      </span>
      <h3>{c.name}</h3>
      <p>
        <MapPin size={14} />
        {c.venue || "Lokasi belum ditentukan"}
      </p>
      <div className="progress-track">
        <span style={{ width: `${(done / c.matches.length) * 100}%` }} />
      </div>
      <div className="competition-card-bottom">
        <span>
          {done} / {c.matches.length} pertandingan
        </span>
        <ArrowUpRight size={19} />
      </div>
    </Link>
  );
}
function SignInEmpty({ login }: { login: () => void }) {
  return (
    <div className="page">
      <Empty
        title="Lapangan Anda dimulai di sini"
        description="Masuk untuk membuat dan mengelola kompetisi Anda."
        action={
          <button className="button primary" onClick={login}>
            Masuk ke workspace <ArrowRight size={17} />
          </button>
        }
      />
    </div>
  );
}
function CompetitionList({
  mine,
  user,
  login,
}: {
  mine: boolean;
  user: User | null;
  login: () => void;
}) {
  const [items, setItems] = useState<Competition[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("all");
  const [status, setStatus] = useState("all");
  const reload = useCallback(() => {
    setError("");
    api<Competition[]>(`competitions${mine ? "?scope=mine" : ""}`)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [mine]);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload, user]);
  if (mine && !user) return <SignInEmpty login={login} />;
  const filtered = items?.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) &&
      (format === "all" || c.format === format) &&
      (status === "all" || c.status === status),
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> {mine ? "YOUR COMPETITIONS" : "AROUND THE PITCH"}
          </div>
          <h1>{mine ? "Kompetisi saya" : "Jelajahi kompetisi"}</h1>
          <p>
            {mine
              ? "Dari draft pertama hingga hasil terakhir. Semuanya di sini."
              : "Temukan permainan. Ikuti setiap momen."}
          </p>
        </div>
        {mine && (
          <Link href="/dashboard/new" className="button primary">
            <Plus size={18} /> Buat kompetisi
          </Link>
        )}
      </div>
      {mine && items && (
        <div className="stats-grid">
          <Stat icon={Trophy} label="Total kompetisi" value={items.length} />
          <Stat
            icon={Radio}
            label="Sedang berlangsung"
            value={items.filter((c) => c.status === "in_progress").length}
          />
          <Stat
            icon={Users}
            label="Tim terdaftar"
            value={items.reduce((s, c) => s + c.teams.length, 0)}
          />
          <Stat
            icon={CheckCircle2}
            label="Pertandingan selesai"
            value={items.reduce(
              (s, c) =>
                s + c.matches.filter((m) => m.status === "final").length,
              0,
            )}
          />
        </div>
      )}
      <div className="filter-bar">
        <div className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama kompetisi…"
            aria-label="Cari kompetisi"
          />
        </div>
        <select
          aria-label="Filter format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="all">Semua format</option>
          {Object.entries(formats).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Semua status</option>
          {["draft", "published", "in_progress", "completed", "archived"].map(
            (v) => (
              <option value={v} key={v}>
                {
                  (
                    {
                      draft: "Draft",
                      published: "Terjadwal",
                      in_progress: "Berlangsung",
                      completed: "Selesai",
                      archived: "Diarsipkan",
                    } as Record<string, string>
                  )[v]
                }
              </option>
            ),
          )}
        </select>
        <SlidersHorizontal size={19} />
      </div>
      {error ? (
        <div className="alert error">
          {error}
          <button onClick={reload}>Coba lagi</button>
        </div>
      ) : !items ? (
        <Loading />
      ) : filtered?.length ? (
        <div className="competition-grid">
          {filtered.map((c) => (
            <CompetitionCard c={c} mine={mine} key={c.id} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            query || format !== "all" || status !== "all"
              ? "Belum ada yang cocok"
              : mine
                ? "Saatnya kick-off pertama"
                : "Belum ada kompetisi publik"
          }
          description={
            mine
              ? "Buat kompetisi, tambahkan tim, dan kami bantu atur jadwalnya."
              : "Kompetisi yang dipublikasikan oleh penyelenggara akan tampil di sini."
          }
          action={
            mine ? (
              <Link href="/dashboard/new" className="button primary">
                <Plus size={16} /> Buat kompetisi
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: number | string;
}) {
  return (
    <div className="stat-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className="stat-icon">
        <Icon size={22} />
      </span>
    </div>
  );
}
function AuthDialog({
  open,
  mode,
  setMode,
  demo,
  close,
  done,
}: {
  open: boolean;
  mode: "login" | "signup" | "reset" | "password";
  setMode: (v: "login" | "signup" | "reset" | "password") => void;
  demo: boolean;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { register, handleSubmit } = useForm<{
    email: string;
    password: string;
    name: string;
  }>();
  const submit = handleSubmit(async (v) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo) {
        await api("demo-login", {
          method: "POST",
          body: JSON.stringify({
            email: v.email,
            name: v.name || v.email.split("@")[0],
          }),
        });
        await done();
      } else {
        if (!authClient) throw new Error("Konfigurasi Supabase belum tersedia");
        if (mode === "reset") {
          const { error } = await authClient.auth.resetPasswordForEmail(
            v.email,
            { redirectTo: window.location.origin },
          );
          if (error) throw error;
          setMessage("Jika email terdaftar, tautan reset akan dikirim.");
        } else if (mode === "password") {
          const { error } = await authClient.auth.updateUser({
            password: v.password,
          });
          if (error) throw error;
          await done();
        } else if (mode === "signup") {
          throw new Error("Akun hanya dapat dibuat oleh admin utama.");
        } else {
          const { error } = await authClient.auth.signInWithPassword({
            email: v.email,
            password: v.password,
          });
          if (error) throw error;
          const access = await api<{ user: User | null }>("session");
          if (!access.user) {
            await authClient.auth.signOut();
            throw new Error(
              "Akun belum diberi akses Fun Liga. Hubungi admin utama.",
            );
          }
          await done();
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  });
  return (
    <Modal
      open={open}
      onClose={close}
      title={
        demo
          ? "Masuk ke demo lokal"
          : mode === "signup"
            ? "Buat akun panitia"
            : mode === "reset"
              ? "Reset kata sandi"
              : mode === "password"
                ? "Kata sandi baru"
                : "Selamat datang kembali"
      }
      description={
        demo
          ? "Akun demo bukan autentikasi produksi. Gunakan email fiktif."
          : "Satu akun, banyak kompetisi. Mulai cerita Anda."
      }
    >
      <form onSubmit={submit} className="form-stack">
        {(demo || mode === "signup") && (
          <label>
            Nama Anda
            <input
              {...register("name")}
              placeholder="Nama panggilan"
              required
              autoComplete="name"
            />
          </label>
        )}
        {mode !== "password" && (
          <label>
            Email
            <input
              {...register("email")}
              type="email"
              placeholder={demo ? "panitia@example.test" : "anda@email.com"}
              required
              autoComplete="email"
            />
          </label>
        )}
        {!demo && mode !== "reset" && (
          <label>
            Kata sandi
            <input
              {...register("password")}
              type="password"
              minLength={8}
              required
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </label>
        )}
        {demo && (
          <div className="alert">
            Data akun hanya digunakan di lingkungan demo ini. Tidak perlu kata
            sandi; siapa pun di demo dapat menggunakan identitas yang sama.
          </div>
        )}
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="alert success">
            {message}
          </div>
        )}
        <button className="button primary full" disabled={busy}>
          {busy
            ? "Memproses…"
            : demo
              ? "Masuk & mulai bermain"
              : mode === "signup"
                ? "Daftar"
                : mode === "reset"
                  ? "Kirim tautan reset"
                  : mode === "password"
                    ? "Simpan kata sandi"
                    : "Masuk"}
          <ArrowRight size={17} />
        </button>
        {!demo &&
          mode === "login" &&
          process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true" && (
            <button
              type="button"
              className="button secondary full"
              disabled={busy}
              onClick={async () => {
                if (!authClient) return;
                const { error } = await authClient.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: window.location.origin },
                });
                if (error) setError(error.message);
              }}
            >
              Lanjutkan dengan Google
            </button>
          )}
        {!demo && mode === "login" && (
          <div className="auth-links">
            <button type="button" onClick={() => setMode("reset")}>
              Lupa kata sandi?
            </button>
          </div>
        )}
        {!demo && mode === "login" && (
          <p className="muted">
            Akun dibuat oleh admin utama. Pendaftaran mandiri tidak tersedia.
          </p>
        )}
        {!demo && mode !== "login" && (
          <button
            type="button"
            className="text-link"
            onClick={() => setMode("login")}
          >
            Kembali ke masuk
          </button>
        )}
      </form>
    </Modal>
  );
}
function CreateCompetition({
  notify,
}: {
  user: User;
  notify: (s: string) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [teamNames, setTeamNames] = useState<string[]>(["", "", "", ""]);
  const [chosen, setChosen] = useState<Format>(() => {
    const v =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("format")
        : null;
    return v && v in formats ? (v as Format) : "fourfeo";
  });
  const [preview, setPreview] = useState<ReturnType<
    typeof competitionInput.parse
  > | null>(null);
  const { register, getValues } = useForm({
    defaultValues: {
      name: "",
      description: "",
      venue: "",
      startDate: "",
      visibility: "public",
      meetings: 2,
      groups: 2,
      qualifiers: 2,
      win: 3,
      draw: 1,
      loss: 0,
      ranking: true,
      thirdPlace: false,
    },
  });
  const next = () => {
    setError("");
    if (step === 1) {
      const v = getValues();
      if (v.name.trim().length < 3) {
        setError("Nama kompetisi minimal 3 karakter");
        return;
      }
      setStep(2);
      return;
    }
    try {
      const input = competitionInput.parse({
        ...getValues(),
        format: chosen,
        teamNames,
      });
      setPreview(input);
      setStep(3);
    } catch (e) {
      setError(
        e instanceof Error
          ? "issues" in e
            ? (e as { issues: { message: string }[] }).issues
                .map((i) => i.message)
                .join(". ")
            : e.message
          : "Data tidak valid",
      );
    }
  };
  const create = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const c = await api<Competition>("competitions", {
        method: "POST",
        body: JSON.stringify(preview),
      });
      notify("Draft tersimpan. Jadwal siap ditinjau.");
      router.push(`/dashboard/competitions/${c.id}/fixtures`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const count = preview
    ? chosen === "knockout"
      ? preview.teamNames.length -
        1 +
        (preview.thirdPlace && preview.teamNames.length >= 4 ? 1 : 0)
      : chosen.includes("group")
        ? Array.from(
            { length: preview.groups },
            (_, i) =>
              preview.teamNames.filter((_, j) => j % preview.groups === i)
                .length,
          ).reduce((sum, n) => sum + ((n * (n - 1)) / 2) * preview.meetings, 0)
        : ((preview.teamNames.length * (preview.teamNames.length - 1)) / 2) *
          preview.meetings
    : 0;
  return (
    <div className="page create-page">
      <Link href="/dashboard" className="back-link">
        <ArrowLeft size={16} /> Kompetisi saya
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> LET’S MAKE IT HAPPEN
          </div>
          <h1>Buat kompetisi baru</h1>
          <p>Atur dasar-dasarnya. Kami bantu sisanya.</p>
        </div>
        <span className="step-count">LANGKAH {step} / 3</span>
      </div>
      <div className="wizard-steps">
        {["Detail kompetisi", "Tim & aturan", "Tinjau jadwal"].map((s, i) => (
          <div key={s} className={step >= i + 1 ? "current" : ""}>
            <span>{step > i + 1 ? <Check size={15} /> : i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <div className="wizard-layout">
        <section className="panel wizard-panel">
          <div className="panel-heading">
            <h2>
              {step === 1
                ? "Cerita apa yang akan dimulai?"
                : step === 2
                  ? "Siapa yang akan bermain?"
                  : "Semua siap untuk kick-off?"}
            </h2>
            <span className="muted">
              {step === 3 ? "Review" : "Wajib diisi *"}
            </span>
          </div>
          {step === 1 ? (
            <div className="form-stack">
              <label>
                Nama kompetisi *
                <input
                  {...register("name")}
                  placeholder="Contoh: Liga Jumat Malam"
                  maxLength={100}
                />
              </label>
              <label>Pilih format *</label>
              <div className="format-options">
                {Object.entries(formats).map(([key, label]) => {
                  const Icon = formatIcons[key as Format];
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setChosen(key as Format);
                        if (key === "fourfeo")
                          setTeamNames((old) =>
                            Array.from({ length: 4 }, (_, i) => old[i] || ""),
                          );
                      }}
                      className={chosen === key ? "selected" : ""}
                    >
                      <Icon size={20} />
                      <span>{label}</span>
                      {chosen === key && <Check size={16} />}
                    </button>
                  );
                })}
              </div>
              <div className="two-cols">
                <label>
                  Lokasi lapangan
                  <input
                    {...register("venue")}
                    placeholder="Nama lapangan"
                    maxLength={150}
                  />
                </label>
                <label>
                  Tanggal mulai
                  <input {...register("startDate")} type="date" />
                </label>
              </div>
              <label>
                Visibilitas
                <select {...register("visibility")}>
                  <option value="public">Publik — muncul di Jelajahi</option>
                  <option value="unlisted">
                    Tautan saja — bagikan langsung
                  </option>
                  <option value="private">Privat — hanya panitia</option>
                </select>
              </label>
              <details className="advanced">
                <summary>
                  Pengaturan tambahan <ChevronDown size={15} />
                </summary>
                <label>
                  Deskripsi
                  <textarea
                    {...register("description")}
                    placeholder="Ceritakan tentang kompetisi ini"
                    maxLength={1000}
                  />
                </label>
              </details>
            </div>
          ) : step === 2 ? (
            <div className="form-stack">
              <div className="section-inline">
                <label>Nama tim *</label>
                <span className="muted">{teamNames.length} tim</span>
              </div>
              {teamNames.map((name, i) => (
                <div className="team-input" key={i}>
                  <span className="team-input-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    aria-label={`Nama tim ${i + 1}`}
                    value={name}
                    onChange={(e) =>
                      setTeamNames((old) =>
                        old.map((v, j) => (i === j ? e.target.value : v)),
                      )
                    }
                    placeholder={`Nama tim ${i + 1}`}
                    maxLength={60}
                  />
                  {chosen !== "fourfeo" && teamNames.length > 2 && (
                    <button
                      aria-label={`Hapus tim ${i + 1}`}
                      className="icon-button"
                      onClick={() =>
                        setTeamNames((old) => old.filter((_, j) => j !== i))
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {chosen !== "fourfeo" && teamNames.length < 32 && (
                <button
                  className="button secondary"
                  onClick={() => setTeamNames((old) => [...old, ""])}
                >
                  <Plus size={16} /> Tambah tim
                </button>
              )}
              {chosen !== "knockout" && (
                <label>
                  Pertemuan per pasangan
                  <input
                    type="number"
                    {...register("meetings", { valueAsNumber: true })}
                    min={1}
                    max={10}
                  />
                  <small>1 kali = sekali bertemu; 2 kali = dua putaran.</small>
                </label>
              )}
              {chosen.includes("group") && (
                <div className="two-cols">
                  <label>
                    Jumlah grup
                    <input
                      type="number"
                      {...register("groups", { valueAsNumber: true })}
                      min={1}
                      max={8}
                    />
                  </label>
                  {chosen === "group_then_knockout" && (
                    <label>
                      Tim lolos per grup
                      <input
                        type="number"
                        {...register("qualifiers", { valueAsNumber: true })}
                        min={1}
                        max={8}
                      />
                    </label>
                  )}
                </div>
              )}
              <details className="advanced">
                <summary>
                  Aturan tambahan <Settings2 size={16} />
                </summary>
                <div className="three-cols">
                  {(["win", "draw", "loss"] as const).map((key, i) => (
                    <label key={key}>
                      {["Poin menang", "Poin seri", "Poin kalah"][i]}
                      <input
                        type="number"
                        {...register(key, { valueAsNumber: true })}
                        min={0}
                        max={20}
                      />
                    </label>
                  ))}
                </div>
                <label className="checkbox">
                  <input type="checkbox" {...register("ranking")} /> Tampilkan
                  klasemen resmi
                </label>
                {(chosen === "knockout" ||
                  chosen === "group_then_knockout") && (
                  <label className="checkbox">
                    <input type="checkbox" {...register("thirdPlace")} />{" "}
                    Pertandingan perebutan tempat ketiga
                  </label>
                )}
              </details>
            </div>
          ) : (
            preview && (
              <div className="review">
                <div className="review-banner">
                  <CheckCircle2 size={32} />
                  <div>
                    <h3>{preview.name}</h3>
                    <p>
                      {formats[preview.format]} · {preview.teamNames.length} tim
                      · {count} pertandingan
                      {chosen === "group_then_knockout" ? " fase grup" : ""}
                    </p>
                  </div>
                </div>
                <div className="review-tags">
                  <Badge status={preview.visibility} />
                  <span>
                    <MapPin size={15} />
                    {preview.venue || "Lokasi belum ditentukan"}
                  </span>
                </div>
                <div className="review-teams">
                  {preview.teamNames.map((name, i) => (
                    <div key={i}>
                      <Shield size={18} />
                      {name}
                    </div>
                  ))}
                </div>
                <div className="alert">
                  Kompetisi dibuat sebagai <b>draft</b>. Anda bisa meninjau,
                  menyusun ulang jadwal, dan menentukan waktu pertandingan
                  sebelum publikasi.
                </div>
                <dl>
                  <div>
                    <dt>Poin menang / seri / kalah</dt>
                    <dd>
                      {preview.win} / {preview.draw} / {preview.loss}
                    </dd>
                  </div>
                  <div>
                    <dt>Klasemen</dt>
                    <dd>{preview.ranking ? "Aktif" : "Dinonaktifkan"}</dd>
                  </div>
                  <div>
                    <dt>Pertemuan per pasangan</dt>
                    <dd>
                      {chosen === "knockout"
                        ? "Sistem gugur"
                        : preview.meetings}
                    </dd>
                  </div>
                </dl>
              </div>
            )
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <div className="wizard-actions">
            {step > 1 ? (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                <ArrowLeft size={16} /> Kembali
              </button>
            ) : (
              <span />
            )}
            <button
              className="button primary"
              disabled={busy}
              onClick={step === 3 ? create : next}
            >
              {busy
                ? "Menyimpan…"
                : step === 3
                  ? "Buat draft & jadwal"
                  : "Lanjutkan"}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <aside className="creation-aside">
          <span className="creation-aside-icon">
            <Sparkles size={25} />
          </span>
          <h3>
            Lebih sedikit administrasi.
            <br />
            Lebih banyak aksi.
          </h3>
          <p>
            Jadwal otomatis yang menyesuaikan format Anda. Skor dan klasemen
            tetap terhubung.
          </p>
          <div>
            <Check size={16} /> Jadwal dibuat otomatis
          </div>
          <div>
            <Check size={16} /> Hasil final dihitung ke klasemen
          </div>
          <div>
            <Check size={16} /> Publikasi setelah Anda siap
          </div>
          <div className="creation-note">
            <CircleHelp size={16} />
            <p>
              Fourfeo? Tepat 4 tim. Jumlah putaran sepenuhnya di tangan Anda.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
function CompetitionView({
  id,
  tab,
  matchId,
  user,
  demo,
  adminRoute,
  notify,
}: {
  id: string;
  tab: string;
  matchId?: string;
  user: User | null;
  demo: boolean;
  adminRoute: boolean;
  notify: (s: string) => void;
}) {
  const [c, setC] = useState<Competition | null>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publish, setPublish] = useState(false);
  const [selected, setSelected] = useState<string | null>(matchId || null);
  const [filter, setFilter] = useState("all");
  const [group, setGroup] = useState("all");
  const [confirmLifecycle, setConfirmLifecycle] = useState<string | null>(null);
  const [tieOpen, setTieOpen] = useState(false);
  const [orderMode, setOrderMode] = useState(false);
  const [shufflePreview, setShufflePreview] = useState<{
    matches: Match[];
    version: number;
  } | null>(null);
  const [shuffleError, setShuffleError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setC(await api<Competition>(`competitions/${id}`));
      setError("");
      setOffline(false);
    } catch (e) {
      setOffline(true);
      if (e instanceof ApiError && (e.status === 404 || e.status === 403))
        setC(null);
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const timer = setInterval(() => void refresh(), 5000);
    const reconnect = () => void refresh();
    window.addEventListener("online", reconnect);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", reconnect);
    };
  }, [refresh]);
  const subscriptionId = c?.id;
  useEffect(() => {
    if (demo || !authClient || !subscriptionId) return;
    const channel = authClient
      .channel(`competition-${subscriptionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "competition_events",
          filter: `competition_id=eq.${subscriptionId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void authClient?.removeChannel(channel);
    };
  }, [demo, subscriptionId, user?.id, refresh]);
  const command = async (data: Record<string, unknown>) => {
    if (!c) throw new Error("Data belum tersedia");
    setBusy(true);
    try {
      const updated = await api<Competition>(`competitions/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...data, version: c.version }),
      });
      setC(updated);
      setError("");
      notify("Perubahan tersimpan");
      return updated;
    } catch (e) {
      if ((e as Error).message.includes("Muat ulang")) await refresh();
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const run = async (data: Record<string, unknown>) => {
    try {
      await command(data);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (!c)
    return (
      <div className="page">
        {error ? (
          <Empty
            title="Kompetisi tidak tersedia"
            description={error}
            action={
              <button
                className="button secondary"
                onClick={() => void refresh()}
              >
                Coba lagi
              </button>
            }
          />
        ) : (
          <Loading />
        )}
      </div>
    );
  const role = roleFor(c, user?.id);
  const edit = adminRoute && !!role;
  const admin = edit && role !== "score_operator";
  const base = edit ? `/dashboard/competitions/${c.id}` : `/c/${c.slug}`;
  const team = (tid: string | null) => c.teams.find((t) => t.id === tid);
  const final = c.matches.filter((m) => m.status === "final").length;
  const live = c.matches.filter((m) => m.status === "live");
  const next = c.matches.find(
    (m) => m.status === "scheduled" && m.home && m.away,
  );
  const activeTab =
    tab === "matches" ? "control" : tab === "schedule" ? "fixtures" : tab;
  const tabs = [
    { key: "overview", label: "Ringkasan", icon: LayoutDashboard },
    { key: "fixtures", label: "Jadwal & hasil", icon: CalendarDays },
    ...(c.rules.ranking && c.format !== "knockout"
      ? [{ key: "standings", label: "Klasemen", icon: ListOrdered }]
      : []),
    ...(c.format.includes("knockout")
      ? [{ key: "bracket", label: "Bracket", icon: Swords }]
      : []),
    { key: "teams", label: "Tim", icon: Shield },
    { key: "players", label: "Top skor & assist", icon: Trophy },
    ...(edit
      ? [{ key: "control", label: "Kontrol skor", icon: Activity }]
      : []),
    ...(admin
      ? [
          { key: "members", label: "Panitia", icon: Users },
          { key: "settings", label: "Pengaturan", icon: Settings2 },
        ]
      : []),
  ];
  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/c/${c.slug}`,
      );
      notify("Tautan kompetisi disalin");
    } catch {
      setError(
        "Tidak dapat menyalin. Tautan publik: " +
          `${window.location.origin}/c/${c.slug}`,
      );
    }
  };
  const reorder = async (source: string, target: string) => {
    const ids = c.matches.map((m) => m.id);
    const from = ids.indexOf(source),
      to = ids.indexOf(target);
    ids.splice(from, 1);
    ids.splice(to, 0, source);
    await run({ type: "reorder", ids });
  };
  return (
    <div className="page competition-page">
      <Link className="back-link" href={edit ? "/dashboard" : "/explore"}>
        <ArrowLeft size={16} /> {edit ? "Kompetisi saya" : "Jelajahi kompetisi"}
      </Link>
      <div className="competition-heading">
        <span className="large-competition-icon">
          <Trophy size={32} />
        </span>
        <div className="competition-title">
          <div className="title-tags">
            <span className="eyebrow">{formats[c.format].toUpperCase()}</span>
            <Badge status={c.status} />
            <Badge status={c.visibility} />
          </div>
          <h1>{c.name}</h1>
          <div className="competition-meta">
            <span>
              <MapPin size={15} />
              {c.venue || "Lokasi belum ditentukan"}
            </span>
            <span>
              <Users size={15} />
              {c.teams.length} tim
            </span>
            {c.startDate && (
              <span>
                <CalendarDays size={15} />
                {date(c.startDate)}
              </span>
            )}
          </div>
        </div>
        <div className="competition-heading-actions">
          {c.status !== "draft" && (
            <button className="button secondary" onClick={share}>
              <Copy size={16} /> Bagikan
            </button>
          )}
          {admin && c.status === "draft" && (
            <button className="button primary" onClick={() => setPublish(true)}>
              <Globe2 size={16} /> Publikasikan
            </button>
          )}
          {role && !edit && (
            <Link
              href={`/dashboard/competitions/${c.id}`}
              className="button primary"
            >
              Kelola <ArrowUpRight size={16} />
            </Link>
          )}
          <span className={`connection ${offline ? "offline" : ""}`}>
            {offline ? <WifiOff size={13} /> : <Wifi size={13} />}{" "}
            {offline
              ? "Koneksi terputus"
              : demo
                ? "Sinkronisasi 5 detik"
                : "Tersinkronisasi"}
          </span>
        </div>
      </div>
      {c.status === "draft" && (
        <div className="draft-banner">
          <Flag size={19} />
          <div>
            <b>Masih di ruang persiapan.</b> Tinjau tim dan jadwal sebelum
            kompetisi tampil untuk penonton.
          </div>
          <span>DRAFT</span>
        </div>
      )}
      <nav className="competition-tabs">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${base}${t.key === "overview" ? "" : `/${!edit && t.key === "fixtures" ? "schedule" : t.key}`}`}
            className={activeTab === t.key ? "active" : ""}
          >
            <t.icon size={17} />
            {t.label}
          </Link>
        ))}
      </nav>
      {error && (
        <div className="alert error" role="alert">
          {error}
          <button onClick={() => void refresh()}>Muat ulang</button>
        </div>
      )}
      {activeTab === "overview" ? (
        <>
          <div className="stats-grid">
            <Stat icon={Users} label="Tim peserta" value={c.teams.length} />
            <Stat
              icon={CalendarDays}
              label="Total pertandingan"
              value={c.matches.length}
            />
            <Stat icon={Radio} label="Live sekarang" value={live.length} />
            <Stat
              icon={CheckCircle2}
              label="Pertandingan final"
              value={final}
            />
          </div>
          <div className="overview-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  {live.length
                    ? "Di lapangan sekarang"
                    : "Pertandingan berikutnya"}
                </h2>
                <span className="muted">
                  <Radio size={16} />
                </span>
              </div>
              {(live.length ? live : next ? [next] : []).map((m) => (
                <div className="featured-match" key={m.id}>
                  <div className="match-label">
                    <span>
                      {m.group ? `Grup ${m.group}` : `Babak ${m.round}`}
                    </span>
                    <Badge status={m.status} />
                  </div>
                  <div className="featured-score">
                    <div>
                      <TeamMark team={team(m.home)} size={58} />
                      <h3>{team(m.home)?.name}</h3>
                    </div>
                    <div>
                      <strong>
                        {m.status === "live"
                          ? `${m.homeScore} : ${m.awayScore}`
                          : "VS"}
                      </strong>
                      <span>
                        {m.scheduledAt
                          ? `${date(m.scheduledAt)} · ${time(m.scheduledAt)} WIB`
                          : "Waktu belum ditentukan"}
                      </span>
                    </div>
                    <div>
                      <TeamMark team={team(m.away)} size={58} />
                      <h3>{team(m.away)?.name}</h3>
                    </div>
                  </div>
                  {edit && (
                    <button
                      className="button secondary full"
                      onClick={() => setSelected(m.id)}
                    >
                      Buka kontrol pertandingan <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              ))}
              {!live.length && !next && (
                <Empty
                  title="Peluit terakhir sudah berbunyi"
                  description="Lihat hasil pertandingan dan klasemen kompetisi ini."
                />
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Perjalanan kompetisi</h2>
                <Badge status={c.status} />
              </div>
              <div className="progress-panel">
                <div className="large-progress">
                  <strong>
                    {Math.round((final / c.matches.length) * 100)}
                    <small>%</small>
                  </strong>
                  <span>pertandingan selesai</span>
                </div>
                <div className="progress-track">
                  <span
                    style={{ width: `${(final / c.matches.length) * 100}%` }}
                  />
                </div>
                <div className="progress-metrics">
                  <span>
                    <b>{final}</b> Final
                  </span>
                  <span>
                    <b>{live.length}</b> Live
                  </span>
                  <span>
                    <b>
                      {c.matches.filter((m) => m.status === "scheduled").length}
                    </b>{" "}
                    Terjadwal
                  </span>
                </div>
                <hr />
                <h3>Tentang kompetisi</h3>
                <p>
                  {c.description ||
                    "Belum ada deskripsi. Setiap pertandingan tetap punya cerita."}
                </p>
                <div className="rule-chips">
                  <span>{c.rules.meetings}× pertemuan</span>
                  <span>Menang +{c.rules.win}</span>
                  <span>Seri +{c.rules.draw}</span>
                </div>
              </div>
            </section>
          </div>
          {c.rules.ranking && c.format !== "knockout" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Klasemen sementara</h2>
                <Link className="text-link" href={`${base}/standings`}>
                  Lihat selengkapnya <ArrowRight size={15} />
                </Link>
              </div>
              <Standings c={c} compact />
            </section>
          )}
        </>
      ) : activeTab === "fixtures" || activeTab === "control" ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                {activeTab === "control"
                  ? "Kontrol pertandingan"
                  : "Jadwal & hasil"}
              </h2>
              <p>
                {edit
                  ? "Ketuk pertandingan untuk catat gol."
                  : "Ketuk pertandingan untuk melihat detail gol."}
              </p>
            </div>
            <div
              className="section-inline schedule-summary"
              style={{ gap: 12 }}
            >
              <span className="muted">{c.matches.length} pertandingan</span>
              {admin && (
                <button
                  className="button secondary small"
                  disabled={
                    busy ||
                    !canShuffleSchedule(c.matches) ||
                    ["archived", "completed", "cancelled"].includes(c.status)
                  }
                  onClick={() => {
                    setShuffleError("");
                    setShufflePreview({
                      matches: shuffleSchedule(c.matches),
                      version: c.version,
                    });
                  }}
                >
                  <Shuffle size={16} /> Acak jadwal
                </button>
              )}
            </div>
          </div>
          {admin && !canShuffleSchedule(c.matches) && (
            <p className="shuffle-unavailable">
              Belum ada urutan alternatif dalam putaran yang sama. Pertandingan
              yang sudah berjalan tetap terkunci.
            </p>
          )}
          <div className="match-filters">
            <div className="filter-pills">
              {[
                ["all", "Semua"],
                ["scheduled", "Terjadwal"],
                ["live", "Live"],
                ["final", "Final"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  className={filter === v ? "active" : ""}
                  onClick={() => setFilter(v)}
                >
                  {l}
                </button>
              ))}
            </div>
            {c.format.includes("group") && (
              <select
                aria-label="Filter grup"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                <option value="all">Semua grup</option>
                {Array.from({ length: c.rules.groups }, (_, i) =>
                  String.fromCharCode(65 + i),
                ).map((g) => (
                  <option key={g} value={g}>
                    Grup {g}
                  </option>
                ))}
              </select>
            )}
          </div>
          {admin && (
            <div className="schedule-tools">
              <button
                className="text-link"
                aria-pressed={orderMode}
                onClick={() => setOrderMode(!orderMode)}
              >
                {orderMode ? "Selesai mengatur" : "Atur urutan"}
              </button>
              {orderMode && c.format.includes("group") && (
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => void run({ type: "group_balance" })}
                >
                  Seimbangkan giliran grup
                </button>
              )}
            </div>
          )}
          <div className="fixture-list">
            {c.matches
              .filter(
                (m) =>
                  (filter === "all" || m.status === filter) &&
                  (group === "all" || m.group === group),
              )
              .map((m) => (
                <div
                  className={`fixture-row ${orderMode ? "is-ordering" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Buka pertandingan ${m.order + 1}: ${team(m.home)?.name || "Tim"} vs ${team(m.away)?.name || "Tim"}`}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      ["Enter", " "].includes(e.key)
                    ) {
                      e.preventDefault();
                      setSelected(m.id);
                    }
                  }}
                  key={m.id}
                  onClick={(e) => {
                    if (
                      (e.target as HTMLElement).closest(
                        "button, input, select, a",
                      )
                    )
                      return;
                    setSelected(m.id);
                  }}
                  draggable={
                    admin &&
                    orderMode &&
                    ["scheduled", "postponed"].includes(m.status) &&
                    filter === "all" &&
                    group === "all"
                  }
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", m.id)
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const source = e.dataTransfer.getData("text/plain");
                    if (source && source !== m.id && admin && orderMode)
                      void reorder(source, m.id);
                  }}
                >
                  <div className="fixture-index">
                    <span>{String(m.order + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="fixture-teams">
                    <span>
                      <TeamMark team={team(m.home)} size={30} />
                      {team(m.home)?.name || "Menunggu pemenang"}
                    </span>
                    <span className="fixture-score">
                      {["live", "final"].includes(m.status)
                        ? `${m.homeScore} – ${m.awayScore}`
                        : "VS"}
                      {m.homePenalty != null &&
                        m.awayPenalty != null &&
                        m.status === "final" && (
                          <small>
                            Pen. {m.homePenalty} – {m.awayPenalty}
                          </small>
                        )}
                    </span>
                    <span>
                      <TeamMark team={team(m.away)} size={30} />
                      {team(m.away)?.name || "Menunggu pemenang"}
                    </span>
                  </div>
                  <div className="fixture-status">
                    <Badge status={m.status} />
                    <small className="fixture-round">
                      {m.group ? `Grup ${m.group} · ` : ""}R{m.round}
                    </small>
                    {m.scheduledAt && (
                      <small>
                        {date(m.scheduledAt)} · {time(m.scheduledAt)}
                      </small>
                    )}
                    {admin && restWarnings(c.matches).has(m.id) && (
                      <small
                        className="rest-warning"
                        title="Tim bermain berurutan; waktu istirahat mungkin singkat."
                      >
                        <Clock3 size={11} /> Jeda pendek
                      </small>
                    )}
                  </div>
                  {admin && orderMode && (
                    <div className="fixture-actions">
                      {admin &&
                        ["scheduled", "postponed"].includes(m.status) && (
                          <div className="reorder-buttons">
                            <button
                              aria-label={`Naikkan pertandingan ${m.order + 1}`}
                              disabled={busy || m.order === 0}
                              onClick={() =>
                                void reorder(m.id, c.matches[m.order - 1].id)
                              }
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              aria-label={`Turunkan pertandingan ${m.order + 1}`}
                              disabled={
                                busy || m.order === c.matches.length - 1
                              }
                              onClick={() =>
                                void reorder(m.id, c.matches[m.order + 1].id)
                              }
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ))}
          </div>
          {!c.matches.some(
            (m) =>
              (filter === "all" || m.status === filter) &&
              (group === "all" || m.group === group),
          ) && (
            <Empty
              title="Belum ada pertandingan di kategori ini"
              description="Pilih kategori lain untuk melihat jadwal."
            />
          )}
          <div className="panel-foot">
            <Shield size={14} /> Hanya hasil final terkonfirmasi yang masuk
            klasemen resmi.
          </div>
        </section>
      ) : activeTab === "players" ? (
        <section className="panel">
          <PlayerLeaders c={c} />
        </section>
      ) : activeTab === "standings" ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Klasemen resmi</h2>
              <p>
                Dihitung dari hasil final. Skor live belum masuk perhitungan.
              </p>
            </div>
            {admin && (
              <button
                className="button secondary small"
                onClick={() => setTieOpen(true)}
              >
                Resolusi seri
              </button>
            )}
          </div>
          <Standings c={c} />
          <div className="panel-foot">
            Urutan: poin → selisih gol → gol memasukkan → head-to-head →
            keputusan panitia. Peringkat seri ditandai.
          </div>
          {admin &&
            c.format === "group_then_knockout" &&
            !c.matches.some((m) => m.stage === "knockout") && (
              <div className="panel-foot">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void run({ type: "qualify" })}
                >
                  <Flag size={16} /> Setujui kualifikasi & buat bracket
                </button>
              </div>
            )}
        </section>
      ) : activeTab === "bracket" ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Perjalanan menuju final</h2>
              <p>Tim dengan bye langsung melaju, tanpa pertandingan fiktif.</p>
            </div>
            <Swords size={21} />
          </div>
          <Bracket c={c} />
          {admin &&
            c.format === "group_then_knockout" &&
            !c.matches.some((m) => m.stage === "knockout") && (
              <div className="panel-foot">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void run({ type: "qualify" })}
                >
                  Setujui kualifikasi & buat bracket <ArrowRight size={16} />
                </button>
              </div>
            )}
        </section>
      ) : activeTab === "teams" ? (
        <Teams c={c} admin={admin} command={command} />
      ) : activeTab === "members" && admin ? (
        <Members c={c} role={role!} command={command} notify={notify} />
      ) : activeTab === "settings" && admin ? (
        <CompetitionSettings
          c={c}
          owner={role === "owner"}
          notify={notify}
          command={command}
          lifecycle={setConfirmLifecycle}
        />
      ) : (
        <Empty
          title="Halaman tidak tersedia"
          description="Periksa hak akses dan navigasi kompetisi Anda."
        />
      )}
      <Modal
        open={!!shufflePreview}
        onClose={() => {
          if (!busy) setShufflePreview(null);
        }}
        title="Tinjau hasil acak jadwal"
        description="Grup, putaran, pasangan lawan, slot waktu, dan pertandingan yang sudah berjalan tetap dijaga."
      >
        {shufflePreview && (
          <div className="form-stack">
            <p>
              Urutan pertandingan diacak dalam grup dan putaran yang sama.
              Giliran grup mengikuti jadwal awal.
            </p>
            <div className="shuffle-preview-list">
              {shufflePreview.matches.map((match, index) => (
                <div
                  key={match.id}
                  className={match.id !== c.matches[index]?.id ? "changed" : ""}
                >
                  <span>{index + 1}</span>
                  <div>
                    <b>
                      {team(match.home)?.name || "Menunggu peserta"} vs{" "}
                      {team(match.away)?.name || "Menunggu peserta"}
                    </b>
                    <small>
                      {match.group ? `Grup ${match.group} · ` : ""}R
                      {match.round}
                      {!["scheduled", "postponed"].includes(match.status)
                        ? " · Terkunci"
                        : ""}
                      {match.scheduledAt ? ` · ${time(match.scheduledAt)}` : ""}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            {shufflePreview.matches.every(
              (match, index) => match.id === c.matches[index]?.id,
            ) && (
              <p>
                Hasil acak kali ini sama dengan urutan awal. Anda bisa mengacak
                ulang.
              </p>
            )}
            {shuffleError && (
              <div className="alert error" role="alert">
                {shuffleError}
              </div>
            )}
            {shufflePreview.version !== c.version && (
              <div className="alert error">
                Jadwal telah berubah. Buat hasil acak baru sebelum menyimpan.
              </div>
            )}
            <button
              className="button secondary full"
              disabled={busy}
              onClick={() => {
                setShuffleError("");
                setShufflePreview({
                  matches: shuffleSchedule(c.matches),
                  version: c.version,
                });
              }}
            >
              Acak ulang
            </button>
            <button
              className="button primary full"
              disabled={
                busy ||
                shufflePreview.version !== c.version ||
                shufflePreview.matches.every(
                  (match, index) => match.id === c.matches[index]?.id,
                )
              }
              onClick={async () => {
                try {
                  await command({
                    type: "shuffle_schedule",
                    ids: shufflePreview.matches.map((match) => match.id),
                  });
                  setShufflePreview(null);
                } catch (e) {
                  setShuffleError((e as Error).message);
                }
              }}
            >
              {busy ? "Menyimpan…" : "Terapkan jadwal acak"}
            </button>
            <button
              className="button secondary full"
              disabled={busy}
              onClick={() => setShufflePreview(null)}
            >
              Batal
            </button>
          </div>
        )}
      </Modal>
      <Modal
        open={publish}
        onClose={() => setPublish(false)}
        title="Siap dibagikan ke penonton?"
        description="Periksa ringkasan sebelum publikasi."
      >
        <div className="form-stack">
          <div className="review-banner">
            <Globe2 size={28} />
            <div>
              <h3>{c.name}</h3>
              <p>
                {c.teams.length} tim · {c.matches.length} pertandingan
              </p>
            </div>
          </div>
          <Badge status={c.visibility} />
          <p className="muted">
            {c.visibility === "private"
              ? "Hanya anggota panitia dapat melihat kompetisi privat."
              : c.visibility === "unlisted"
                ? "Dapat dibuka melalui tautan, tidak muncul di Jelajahi."
                : "Akan muncul di Jelajahi dan dapat dilihat tanpa akun."}
          </p>
          {restWarnings(c.matches).size > 0 && (
            <div className="alert">
              Ada {restWarnings(c.matches).size} pertandingan dengan jeda
              pendek. Ini peringatan, bukan larangan.
            </div>
          )}
          <button
            className="button primary full"
            disabled={busy}
            onClick={async () => {
              try {
                await command({ type: "publish" });
                setPublish(false);
              } catch (e) {
                setError((e as Error).message);
                setPublish(false);
              }
            }}
          >
            Ya, publikasikan <ArrowUpRight size={17} />
          </button>
        </div>
      </Modal>
      <Modal
        open={!!confirmLifecycle}
        onClose={() => setConfirmLifecycle(null)}
        title="Tutup fase kompetisi?"
        description="Hasil dan audit tetap tersimpan."
      >
        <p>
          Anda akan mengubah status menjadi{" "}
          <b>
            {confirmLifecycle === "archived"
              ? "Diarsipkan"
              : confirmLifecycle === "completed"
                ? "Selesai"
                : "Dibatalkan"}
          </b>
          . Kontrol skor akan dinonaktifkan.
        </p>
        <button
          className="button primary full"
          disabled={busy}
          onClick={async () => {
            await run({ type: "lifecycle", status: confirmLifecycle });
            setConfirmLifecycle(null);
          }}
        >
          Konfirmasi
        </button>
      </Modal>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={edit ? "Catat gol & kelola pertandingan" : "Detail pertandingan"}
        description={
          edit
            ? "Catat pencetak gol dan assist. Skor otomatis mengikuti catatan gol."
            : "Gol, assist, dan hasil pertandingan."
        }
      >
        {c.matches.find((m) => m.id === selected) &&
          (edit ? (
            <MatchControl
              key={selected}
              c={c}
              match={c.matches.find((m) => m.id === selected)!}
              role={role!}
              command={command}
            />
          ) : (
            <>
              <div className="spectator-match-score">
                <h3>
                  {team(c.matches.find((m) => m.id === selected)!.home)?.name}{" "}
                  vs{" "}
                  {team(c.matches.find((m) => m.id === selected)!.away)?.name}
                </h3>
                <strong>
                  {c.matches.find((m) => m.id === selected)!.homeScore} –{" "}
                  {c.matches.find((m) => m.id === selected)!.awayScore}
                </strong>
                <Badge
                  status={c.matches.find((m) => m.id === selected)!.status}
                />
              </div>
              <GoalTimeline
                c={c}
                match={c.matches.find((m) => m.id === selected)!}
              />
            </>
          ))}
      </Modal>
      <Modal
        open={tieOpen}
        onClose={() => setTieOpen(false)}
        title="Resolusi peringkat seri"
        description="Keputusan ini hanya berlaku saat seluruh tie-break otomatis sama."
      >
        <TieResolution
          c={c}
          command={command}
          close={() => setTieOpen(false)}
        />
      </Modal>
    </div>
  );
}
function Standings({
  c,
  compact = false,
}: {
  c: Competition;
  compact?: boolean;
}) {
  const groups = c.format.includes("group")
    ? Array.from({ length: c.rules.groups }, (_, i) =>
        String.fromCharCode(65 + i),
      )
    : [undefined];
  return (
    <>
      {groups.slice(0, compact ? 1 : groups.length).map((g) => (
        <div key={g || "league"} className="standings-group">
          {g && <h3>Grup {g}</h3>}
          <div className="table-scroll">
            <table className="standings-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tim</th>
                  <th title="Main">M</th>
                  <th title="Menang">M+</th>
                  <th title="Seri">S</th>
                  <th title="Kalah">K</th>
                  {!compact && (
                    <>
                      <th title="Gol memasukkan">GM</th>
                      <th title="Gol kemasukan">GK</th>
                    </>
                  )}
                  <th title="Selisih gol">SG</th>
                  <th>Poin</th>
                </tr>
              </thead>
              <tbody>
                {standings(c, g).map((r, i) => (
                  <tr key={r.team.id}>
                    <td>
                      <span
                        className={
                          i === 0 && r.played && !r.tied ? "rank first" : "rank"
                        }
                      >
                        {r.position}
                      </span>
                    </td>
                    <td>
                      <div className="table-team">
                        <TeamMark team={r.team} size={29} />
                        <span>
                          {r.team.name}
                          {r.tied && <small className="tie-label">Seri</small>}
                        </span>
                      </div>
                    </td>
                    <td>{r.played}</td>
                    <td>{r.wins}</td>
                    <td>{r.draws}</td>
                    <td>{r.losses}</td>
                    {!compact && (
                      <>
                        <td>{r.gf}</td>
                        <td>{r.ga}</td>
                      </>
                    )}
                    <td className={r.gd > 0 ? "positive" : ""}>
                      {r.gd > 0 ? "+" : ""}
                      {r.gd}
                    </td>
                    <td>
                      <strong className="points">{r.points}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
function Bracket({ c }: { c: Competition }) {
  const ms = c.matches.filter(
    (m) => m.stage === "knockout" && m.sourceOutcome !== "loser",
  );
  if (!ms.length)
    return (
      <Empty
        title="Bracket belum dibuat"
        description="Selesaikan fase grup, lalu setujui kualifikasi untuk memulai babak gugur."
      />
    );
  const rounds = [...new Set(ms.map((m) => m.round))].sort();
  const third = c.matches.find((m) => m.sourceOutcome === "loser");
  const render = (m: Match) => (
    <div className="bracket-match" key={m.id}>
      <div className="bracket-match-heading">
        <small>M{m.order + 1}</small>
        <Badge status={m.status} />
      </div>
      {[m.home, m.away].map((tid, i) => {
        const t = c.teams.find((t) => t.id === tid);
        return (
          <div className={m.winner && m.winner === tid ? "winner" : ""} key={i}>
            <TeamMark team={t} size={26} />
            <span>{t?.name || "Menunggu pemenang"}</span>
            <b>
              {m.status === "final" || m.status === "live"
                ? i === 0
                  ? m.homeScore
                  : m.awayScore
                : "–"}
            </b>
          </div>
        );
      })}
      {m.homePenalty != null && m.awayPenalty != null && (
        <small className="penalty-caption">
          Penalti {m.homePenalty} – {m.awayPenalty}
        </small>
      )}
    </div>
  );
  return (
    <>
      <div className="bracket-scroll">
        {rounds.map((round, i) => (
          <div className="bracket-round" key={round}>
            <h3>
              {i === rounds.length - 1
                ? "Final"
                : i === rounds.length - 2
                  ? "Semifinal"
                  : `Babak ${round}`}
            </h3>
            <div>{ms.filter((m) => m.round === round).map(render)}</div>
          </div>
        ))}
      </div>
      {third && (
        <div className="third-place">
          <h3>Perebutan tempat ketiga</h3>
          {render(third)}
        </div>
      )}
    </>
  );
}
function MatchControl({
  c,
  match,
  role,
  command,
}: {
  c: Competition;
  match: Match;
  role: Role;
  command: (data: Record<string, unknown>) => Promise<Competition>;
}) {
  const [home, setHome] = useState(match.homeScore);
  const [away, setAway] = useState(match.awayScore);
  const [hp, setHp] = useState<string>(match.homePenalty?.toString() || "");
  const [ap, setAp] = useState<string>(match.awayPenalty?.toString() || "");
  const [reason, setReason] = useState("");
  const [savedVersion, setSavedVersion] = useState(match.version);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scheduled, setScheduled] = useState(
    match.scheduledAt
      ? new Date(
          new Date(match.scheduledAt).getTime() -
            new Date(match.scheduledAt).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "",
  );
  const team = (tid: string | null) => c.teams.find((t) => t.id === tid);
  const locked = ["archived", "completed", "cancelled"].includes(c.status);
  const stale = match.version !== savedVersion;
  const send = async (data: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const updated = await command({
        ...data,
        matchId: match.id,
        matchVersion: savedVersion,
      });
      const m = updated.matches.find((m) => m.id === match.id)!;
      setSavedVersion(m.version);
      setHome(m.homeScore);
      setAway(m.awayScore);
      setHp(m.homePenalty?.toString() || "");
      setAp(m.awayPenalty?.toString() || "");
      setSaved(true);
      setConfirm(false);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const reload = () => {
    setHome(match.homeScore);
    setAway(match.awayScore);
    setSavedVersion(match.version);
    setHp(match.homePenalty?.toString() || "");
    setAp(match.awayPenalty?.toString() || "");
    setError("");
    setConfirm(false);
  };
  const scoreData = {
    homeScore: home,
    awayScore: away,
    homePenalty: hp === "" ? null : Number(hp),
    awayPenalty: ap === "" ? null : Number(ap),
  };
  const stepper = (side: "home" | "away") => {
    const value = side === "home" ? home : away;
    const setter = side === "home" ? setHome : setAway;
    if (match.goals !== undefined)
      return <strong className="recorded-score">{value}</strong>;
    return (
      <div className="score-stepper">
        <button
          aria-label={`Kurangi skor ${side === "home" ? "tuan rumah" : "tamu"}`}
          disabled={busy || value === 0 || locked || stale}
          onClick={() => {
            setter(Math.max(0, value - 1));
            setSaved(false);
          }}
        >
          −
        </button>
        <input
          aria-label={`Skor ${side === "home" ? "tuan rumah" : "tamu"}`}
          type="number"
          min={0}
          max={999}
          value={value}
          disabled={busy || locked || stale}
          onChange={(e) => {
            setter(Number(e.target.value));
            setSaved(false);
          }}
        />
        <button
          aria-label={`Tambah skor ${side === "home" ? "tuan rumah" : "tamu"}`}
          disabled={busy || locked || stale}
          onClick={() => {
            setter(value + 1);
            setSaved(false);
          }}
        >
          +
        </button>
      </div>
    );
  };
  return (
    <div className="match-control">
      <div className="control-meta">
        <span>
          Pertandingan {String(match.order + 1).padStart(2, "0")}{" "}
          {match.group ? `· Grup ${match.group}` : ""}
        </span>
        <Badge status={match.status} />
      </div>
      <div className="control-teams">
        <div>
          <TeamMark team={team(match.home)} size={52} />
          <h3>{team(match.home)?.name || "Menunggu peserta"}</h3>
          <strong className="recorded-score">{home}</strong>
        </div>
        <span className="score-colon">:</span>
        <div>
          <TeamMark team={team(match.away)} size={52} />
          <h3>{team(match.away)?.name || "Menunggu peserta"}</h3>
          <strong className="recorded-score">{away}</strong>
        </div>
      </div>
      <MatchGoals
        c={c}
        match={match}
        busy={busy}
        error={error}
        disabled={
          locked || stale || c.status === "draft" || !match.home || !match.away
        }
        send={send}
      />
      {match.goals === undefined && (
        <details className="legacy-score-tools">
          <summary>Skor lama / tanpa catatan pemain</summary>
          <p>
            Gunakan untuk melengkapi hasil lama yang belum memiliki nama pemain.
            Untuk gol baru, gunakan tombol Gol di atas.
          </p>
          <div className="two-cols">
            {stepper("home")}
            {stepper("away")}
          </div>
        </details>
      )}
      {stale && (
        <div className="alert error">
          Pertandingan telah diperbarui panitia lain.{" "}
          <button onClick={reload}>Muat skor terbaru</button>
        </div>
      )}
      {locked ? (
        <div className="alert">
          Kompetisi ditutup. Hasil tidak dapat diubah.
        </div>
      ) : c.status === "draft" ? (
        <div className="alert">
          Publikasikan kompetisi untuk mulai mencatat skor.
        </div>
      ) : !match.home || !match.away ? (
        <div className="alert">Menunggu peserta dari babak sebelumnya.</div>
      ) : (
        <div className="form-stack">
          {match.stage === "knockout" && home === away && (
            <div className="two-cols">
              <label>
                Penalti {team(match.home)?.name}
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                />
              </label>
              <label>
                Penalti {team(match.away)?.name}
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={ap}
                  onChange={(e) => setAp(e.target.value)}
                />
              </label>
            </div>
          )}
          {match.status === "final" && (
            <label>
              Alasan koreksi *
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Jelaskan alasan perubahan hasil"
                minLength={5}
                maxLength={500}
              />
            </label>
          )}
          {confirm ? (
            <div className="confirm-final">
              <h3>
                Konfirmasi{" "}
                {match.status === "final" ? "koreksi" : "hasil final"}?
              </h3>
              <p>
                {team(match.home)?.name}{" "}
                <b>
                  {home} – {away}
                </b>{" "}
                {team(match.away)?.name}
                {hp !== "" && ap !== "" ? ` (penalti ${hp}–${ap})` : ""}
              </p>
              <p className="muted">
                Hasil ini akan masuk ke klasemen resmi dan audit.
              </p>
              <div className="two-cols">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                >
                  Kembali
                </button>
                <button
                  className="button primary"
                  disabled={busy || stale}
                  onClick={() =>
                    void send({
                      type: match.status === "final" ? "correct" : "finalize",
                      ...scoreData,
                      confirm: true,
                      reason,
                    })
                  }
                >
                  {busy ? "Menyimpan…" : "Konfirmasi & simpan"}
                </button>
              </div>
            </div>
          ) : (
            <div className="control-actions">
              {match.status === "scheduled" && (
                <button
                  className="button secondary full"
                  disabled={busy || stale}
                  onClick={() =>
                    void send({ type: "match_status", status: "live" })
                  }
                >
                  <Radio size={17} /> Mulai LIVE
                </button>
              )}
              {match.status === "live" && match.goals === undefined && (
                <button
                  className="button primary full"
                  disabled={busy || stale}
                  onClick={() => void send({ type: "score", ...scoreData })}
                >
                  {busy ? "Menyimpan…" : "Simpan skor live"}
                  <Check size={17} />
                </button>
              )}
              {["scheduled", "live", "final"].includes(match.status) && (
                <button
                  className="button secondary full"
                  disabled={busy || stale}
                  onClick={() => setConfirm(true)}
                >
                  {match.status === "final"
                    ? "Tinjau koreksi hasil"
                    : "Tinjau hasil final"}
                  <Flag size={16} />
                </button>
              )}
              {match.status === "postponed" && (
                <button
                  className="button secondary full"
                  disabled={busy || stale}
                  onClick={() =>
                    void send({ type: "match_status", status: "scheduled" })
                  }
                >
                  Jadwalkan kembali
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {role !== "score_operator" && !locked && (
        <details className="advanced">
          <summary>
            Waktu & status pertandingan <ChevronDown size={16} />
          </summary>
          <div className="form-stack">
            {["scheduled", "postponed"].includes(match.status) && (
              <>
                <label>
                  Waktu pertandingan (zona waktu browser)
                  <input
                    type="datetime-local"
                    value={scheduled}
                    onChange={(e) => setScheduled(e.target.value)}
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={busy || stale}
                  onClick={() =>
                    void send({
                      type: "schedule",
                      scheduledAt: scheduled
                        ? new Date(scheduled).toISOString()
                        : null,
                    })
                  }
                >
                  Simpan jadwal
                </button>
              </>
            )}
            {["live", "scheduled"].includes(match.status) && (
              <button
                className="button secondary"
                disabled={busy || stale}
                onClick={() =>
                  void send({ type: "match_status", status: "postponed" })
                }
              >
                Tunda pertandingan
              </button>
            )}
            {["scheduled", "postponed"].includes(match.status) && (
              <button
                className="button danger"
                disabled={busy || stale}
                onClick={() =>
                  void send({ type: "match_status", status: "cancelled" })
                }
              >
                Batalkan pertandingan
              </button>
            )}
            {match.status === "cancelled" && (
              <button
                className="button secondary"
                disabled={busy || stale}
                onClick={() =>
                  void send({ type: "match_status", status: "scheduled" })
                }
              >
                Aktifkan kembali
              </button>
            )}
          </div>
        </details>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <div className="alert success" role="status">
          <CheckCircle2 size={15} /> Tersimpan di server
        </div>
      )}
      <p className="control-footnote">
        <Shield size={13} /> Skor live tidak mengubah klasemen resmi.
      </p>
    </div>
  );
}
function Teams({
  c,
  admin,
  command,
}: {
  c: Competition;
  admin: boolean;
  command: (data: Record<string, unknown>) => Promise<Competition>;
}) {
  const [edit, setEdit] = useState(false),
    [teams, setTeams] = useState(c.teams),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<Match[] | null>(null);
  const changed =
    teams.length !== c.teams.length ||
    teams.some(
      (t) => !c.teams.some((old) => old.id === t.id && old.group === t.group),
    );
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await command({
        type: "teams",
        teams: teams.map(({ id, name, group }) => ({ id, name, group })),
        confirm: !!preview,
      });
      setEdit(false);
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const review = () => {
    setError("");
    try {
      competitionInput.parse({
        name: c.name,
        format: c.format,
        teamNames: teams.map((t) => t.name),
        ...c.rules,
      });
      if (changed) setPreview(generateFixtures({ ...c, teams }));
      else void save();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Tim peserta</h2>
          <p>{c.teams.length} tim, satu semangat permainan.</p>
        </div>
        {admin && c.status === "draft" && (
          <button
            className="button secondary small"
            onClick={() => {
              setTeams(c.teams);
              setError("");
              setEdit(!edit);
            }}
          >
            {edit ? "Batal edit" : "Edit tim & grup"}
          </button>
        )}
      </div>
      <div className="teams-grid">
        {(edit ? teams : c.teams).map((t, i) => (
          <div className="team-card" key={t.id}>
            <TeamMark team={t} size={50} />
            <div>
              {edit ? (
                <input
                  aria-label={`Edit nama tim ${i + 1}`}
                  value={t.name}
                  onChange={(e) =>
                    setTeams(
                      teams.map((x) =>
                        x.id === t.id ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              ) : (
                <h3>{t.name}</h3>
              )}
              {t.group &&
                (edit ? (
                  <select
                    aria-label={`Grup ${t.name}`}
                    value={t.group}
                    onChange={(e) =>
                      setTeams(
                        teams.map((x) =>
                          x.id === t.id ? { ...x, group: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    {Array.from({ length: c.rules.groups }, (_, i) =>
                      String.fromCharCode(65 + i),
                    ).map((g) => (
                      <option value={g} key={g}>
                        Grup {g}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="muted">Grup {t.group}</span>
                ))}
            </div>
            {edit && c.format !== "fourfeo" && teams.length > 2 ? (
              <button
                className="icon-button"
                aria-label={`Hapus tim ${i + 1}`}
                onClick={() => setTeams(teams.filter((x) => x.id !== t.id))}
              >
                <X size={16} />
              </button>
            ) : (
              <small>{String(i + 1).padStart(2, "0")}</small>
            )}
          </div>
        ))}
      </div>
      {edit && (
        <div className="panel-foot">
          <div className="alert">
            Nama baru mempertahankan jadwal. Perubahan peserta atau grup perlu
            ditinjau dan membuat ulang jadwal draft.
          </div>
          {error && <div className="alert error">{error}</div>}
          {c.format !== "fourfeo" && teams.length < 32 && (
            <button
              className="button secondary"
              onClick={() =>
                setTeams([
                  ...teams,
                  {
                    id: `new-${crypto.randomUUID()}`,
                    name: "",
                    color: ACCENT_COLOR,
                    group: c.format.includes("group")
                      ? String.fromCharCode(
                          65 + (teams.length % c.rules.groups),
                        )
                      : null,
                  },
                ])
              }
            >
              <Plus size={16} /> Tambah tim
            </button>
          )}
          <button className="button primary" disabled={busy} onClick={review}>
            {busy
              ? "Menyimpan…"
              : changed
                ? "Tinjau perubahan"
                : "Simpan nama tim"}
          </button>
        </div>
      )}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Tinjau jadwal baru"
        description="Hanya jadwal draft yang diganti. Nama dan ID tim yang sudah ada tetap dipertahankan."
      >
        <div className="form-stack">
          <p>
            {teams.length} tim · {preview?.length} pertandingan baru (sebelumnya{" "}
            {c.matches.length})
          </p>
          <div className="preview-pairs">
            {preview?.slice(0, 6).map((m) => (
              <div key={m.id}>
                <span>
                  {teams.find((t) => t.id === m.home)?.name ||
                    "Pemenang babak sebelumnya"}
                </span>
                <small>vs</small>
                <span>
                  {teams.find((t) => t.id === m.away)?.name ||
                    "Pemenang babak sebelumnya"}
                </span>
              </div>
            ))}
          </div>
          {error && <div className="alert error">{error}</div>}
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void save()}
          >
            Konfirmasi tim & buat ulang jadwal
          </button>
        </div>
      </Modal>
    </section>
  );
}
function Members({
  c,
  role,
  command,
  notify,
}: {
  c: Competition;
  role: Role;
  command: (data: Record<string, unknown>) => Promise<Competition>;
  notify: (s: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "score_operator">(
    "score_operator",
  );
  const [link, setLink] = useState("");
  const [transfer, setTransfer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [invites, setInvites] = useState<
    {
      token_hash: string;
      role: string;
      email: string | null;
      expires_at: number;
      accepted_at: number | null;
    }[]
  >([]);
  const load = useCallback(
    () =>
      api<typeof invites>(`competitions/${c.id}/invites`)
        .then(setInvites)
        .catch((e) => setError(e.message)),
    [c.id],
  );
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const invite = async () => {
    setBusy(true);
    setError("");
    try {
      const { token } = await api<{ token: string }>(
        `competitions/${c.id}/invites`,
        { method: "POST", body: JSON.stringify({ email, role: inviteRole }) },
      );
      setLink(`${window.location.origin}/invite/${token}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="overview-grid">
      <Modal
        open={!!transfer}
        onClose={() => setTransfer(null)}
        title="Pindahkan kepemilikan?"
        description="Owner baru mendapat kendali penuh. Anda tetap menjadi admin."
      >
        <div className="form-stack">
          <p>
            Kepemilikan akan diberikan kepada{" "}
            <b>{c.members.find((m) => m.userId === transfer)?.email}</b>.
          </p>
          {error && <div className="alert error">{error}</div>}
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await command({
                  type: "transfer",
                  userId: transfer,
                  confirm: true,
                });
                setTransfer(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Konfirmasi transfer owner
          </button>
        </div>
      </Modal>
      <section className="panel">
        <div className="panel-heading">
          <h2>Panitia kompetisi</h2>
          <span className="muted">{c.members.length} anggota</span>
        </div>
        <div className="member-list">
          {c.members.map((m) => (
            <div className="member-row" key={m.userId}>
              <span className="avatar">
                {m.email.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <b>{m.email}</b>
                <span>{memberLabels[m.role]}</span>
              </div>
              {role === "owner" && m.role !== "owner" && (
                <button
                  className="button secondary small"
                  onClick={() => setTransfer(m.userId)}
                >
                  Transfer owner
                </button>
              )}
              {m.role !== "owner" &&
                (role === "owner" || m.role === "score_operator") && (
                  <button
                    className="button secondary small"
                    onClick={async () => {
                      try {
                        await command({ type: "revoke", userId: m.userId });
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Cabut akses
                  </button>
                )}
            </div>
          ))}
        </div>
        <div className="panel-heading">
          <h3>Undangan aktif</h3>
        </div>
        {invites
          .filter((i) => !i.accepted_at && i.expires_at > now)
          .map((i) => (
            <div className="invite-row" key={i.token_hash}>
              <div>
                {i.email || "Tautan tanpa batasan email"}
                <small>
                  {memberLabels[i.role as Role]} · kedaluwarsa{" "}
                  {date(new Date(i.expires_at).toISOString())}
                </small>
              </div>
              <button
                className="button secondary small"
                onClick={async () => {
                  try {
                    await api(`competitions/${c.id}/invites`, {
                      method: "DELETE",
                      body: JSON.stringify({ hash: i.token_hash }),
                    });
                    await load();
                    notify("Undangan dicabut");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Cabut
              </button>
            </div>
          ))}
        {!invites.some((i) => !i.accepted_at && i.expires_at > now) && (
          <p className="muted padded">Belum ada undangan aktif.</p>
        )}
      </section>
      <section className="panel padded">
        <h2>Undang rekan panitia</h2>
        <p className="muted">
          Bagikan tautan secara pribadi. Berlaku selama 72 jam dan hanya dapat
          digunakan sekali.
        </p>
        <div className="form-stack">
          <label>
            Email penerima (opsional)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rekan@email.com"
            />
          </label>
          <label>
            Peran
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "admin" | "score_operator")
              }
            >
              <option value="score_operator">Operator skor</option>
              {role === "owner" && (
                <option value="admin">Admin kompetisi</option>
              )}
            </select>
          </label>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void invite()}
          >
            <Plus size={16} /> {busy ? "Membuat…" : "Buat tautan undangan"}
          </button>
          {link && (
            <div className="invite-link">
              <input aria-label="Tautan undangan" value={link} readOnly />
              <button
                className="icon-button"
                aria-label="Salin undangan"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    notify("Tautan undangan disalin");
                  } catch {
                    setError("Salin tautan secara manual");
                  }
                }}
              >
                <Copy size={16} />
              </button>
            </div>
          )}
          {error && <div className="alert error">{error}</div>}
        </div>
      </section>
    </div>
  );
}
function CompetitionSettings({
  c,
  owner,
  notify,
  command,
  lifecycle,
}: {
  c: Competition;
  owner: boolean;
  notify: (message: string) => void;
  command: (data: Record<string, unknown>) => Promise<Competition>;
  lifecycle: (s: string) => void;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    if (deleting || deleteName !== c.name) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api(`competitions/${c.id}`, {
        method: "DELETE",
        body: JSON.stringify({ name: deleteName, version: c.version }),
      });
      notify("Kompetisi berhasil dihapus");
      router.push("/dashboard");
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  };
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: c.name,
      description: c.description,
      venue: c.venue,
      visibility: c.visibility,
    },
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = handleSubmit(async (settings) => {
    setBusy(true);
    try {
      await command({ type: "settings", settings });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  });
  return (
    <div className="overview-grid">
      <section className="panel padded">
        <h2>Pengaturan kompetisi</h2>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Nama
            <input
              {...register("name")}
              minLength={3}
              maxLength={100}
              required
            />
          </label>
          <label>
            Lokasi
            <input {...register("venue")} maxLength={150} />
          </label>
          <label>
            Deskripsi
            <textarea {...register("description")} maxLength={1000} />
          </label>
          <label>
            Visibilitas
            <select {...register("visibility")}>
              <option value="public">Publik</option>
              <option value="unlisted">Tautan saja</option>
              <option value="private">Privat</option>
            </select>
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="button primary" disabled={busy}>
            Simpan pengaturan <Check size={17} />
          </button>
        </form>
        <hr />
        <RulesEditor c={c} command={command} />
        <hr />
        <h3>Siklus kompetisi</h3>
        <p className="muted">
          Tutup pertandingan live terlebih dahulu. Hasil tetap tersimpan.
        </p>
        <div className="lifecycle-buttons">
          <button
            className="button secondary"
            disabled={
              c.status === "draft" ||
              c.status === "archived" ||
              c.status === "completed"
            }
            onClick={() => lifecycle("completed")}
          >
            Selesaikan
          </button>
          <button
            className="button secondary"
            disabled={c.status === "draft" || c.status === "archived"}
            onClick={() => lifecycle("archived")}
          >
            Arsipkan
          </button>
          <button
            className="button danger"
            disabled={c.status === "draft" || c.status === "cancelled"}
            onClick={() => lifecycle("cancelled")}
          >
            Batalkan
          </button>
        </div>
        {owner && (
          <>
            <hr />
            <div className="form-stack">
              <h3>Hapus kompetisi</h3>
              <p className="muted">
                Hapus permanen kompetisi beserta tim, jadwal, skor, hasil,
                riwayat perubahan, akses panitia, dan undangannya. Tindakan ini
                tidak dapat dibatalkan.
              </p>
              <button
                className="button danger"
                disabled={busy || deleting}
                onClick={() => {
                  setDeleteName("");
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 size={16} /> Hapus kompetisi
              </button>
            </div>
          </>
        )}
      </section>
      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        title="Hapus kompetisi permanen?"
        description="Seluruh data kompetisi akan dihapus dan tidak dapat dipulihkan."
      >
        <div className="form-stack">
          <p>
            Untuk mengonfirmasi, ketik nama kompetisi: <b>{c.name}</b>
          </p>
          <label>
            Nama kompetisi untuk konfirmasi
            <input
              value={deleteName}
              onChange={(e) => setDeleteName(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              maxLength={100}
            />
          </label>
          {deleteError && (
            <div className="alert error" role="alert">
              {deleteError}
            </div>
          )}
          <button
            className="button danger full"
            disabled={deleting || deleteName !== c.name}
            onClick={() => void remove()}
          >
            <Trash2 size={16} /> {deleting ? "Menghapus…" : "Hapus permanen"}
          </button>
          <button
            className="button secondary full"
            disabled={deleting}
            onClick={() => setDeleteOpen(false)}
          >
            Kembali
          </button>
        </div>
      </Modal>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Jejak perubahan</h2>
            <p>Setiap keputusan punya catatan.</p>
          </div>
          <Clock3 size={20} />
        </div>
        <div className="audit-list">
          {c.audit
            .slice()
            .reverse()
            .map((a) => (
              <details key={a.id}>
                <summary>
                  <span className="audit-dot" />
                  <div>
                    <b>
                      {(
                        {
                          score: "Skor live diperbarui",
                          goal_add: "Gol dicatat",
                          goal_update: "Catatan gol diperbarui",
                          goal_delete: "Gol dihapus",
                          finalize: "Hasil final dikonfirmasi",
                          correct: "Hasil final dikoreksi",
                          publish: "Kompetisi dipublikasikan",
                          reorder: "Jadwal diurutkan",
                          shuffle_schedule:
                            "Jadwal diacak dengan putaran tetap",
                          group_balance: "Giliran grup diseimbangkan",
                          settings: "Pengaturan diubah",
                          rules: "Aturan dan jadwal diperbarui",
                          transfer: "Kepemilikan dipindahkan",
                          match_status: "Status pertandingan diubah",
                          revoke: "Akses anggota dicabut",
                          schedule: "Waktu pertandingan diatur",
                          teams: "Tim diperbarui",
                          qualify: "Kualifikasi disetujui",
                          resolve_tie: "Peringkat seri diputuskan",
                          invite_accepted: "Undangan diterima",
                          lifecycle: "Kompetisi ditutup",
                        } as Record<string, string>
                      )[a.event] || a.event}
                    </b>
                    <small>
                      {a.actor} · {date(a.at)} {time(a.at)}
                    </small>
                  </div>
                  <ChevronDown size={15} />
                </summary>
                {a.reason && <p>Alasan: {a.reason}</p>}
                <pre>
                  {JSON.stringify(
                    { sebelum: a.before, sesudah: a.after },
                    null,
                    2,
                  )}
                </pre>
              </details>
            ))}
        </div>
        {!c.audit.length && (
          <Empty
            title="Belum ada perubahan"
            description="Aktivitas panitia akan dicatat di sini."
          />
        )}
      </section>
    </div>
  );
}
function TieResolution({
  c,
  command,
  close,
}: {
  c: Competition;
  command: (data: Record<string, unknown>) => Promise<Competition>;
  close: () => void;
}) {
  const [ids, setIds] = useState(
    c.tieOrder.length ? c.tieOrder : c.teams.map((t) => t.id),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const move = (i: number, d: number) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setIds(next);
  };
  return (
    <div className="form-stack">
      {ids.map((id, i) => (
        <div className="tie-row" key={id}>
          <span>
            {i + 1}. {c.teams.find((t) => t.id === id)?.name}
          </span>
          <button
            className="icon-button"
            aria-label={`Naikkan ${i + 1}`}
            disabled={i === 0}
            onClick={() => move(i, -1)}
          >
            <ArrowUp size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={`Turunkan ${i + 1}`}
            disabled={i === ids.length - 1}
            onClick={() => move(i, 1)}
          >
            <ArrowDown size={16} />
          </button>
        </div>
      ))}
      <label>
        Alasan keputusan
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={5}
          maxLength={500}
          placeholder="Contoh: hasil undian panitia setelah tie-break seri"
        />
      </label>
      {error && <div className="alert error">{error}</div>}
      <button
        className="button primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await command({ type: "resolve_tie", ids, reason });
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Simpan keputusan
      </button>
    </div>
  );
}
function Account({
  user,
  demo,
  login,
  logout,
}: {
  user: User | null;
  demo: boolean;
  login: () => void;
  logout: () => Promise<void>;
}) {
  const [name, setName] = useState(user?.name || "");
  const [message, setMessage] = useState("");
  if (!user) return <SignInEmpty login={login} />;
  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> YOUR CORNER
          </div>
          <h1>Akun saya</h1>
          <p>Identitas di balik setiap kick-off.</p>
        </div>
      </div>
      <section className="panel padded">
        <div className="account-header">
          <span className="avatar large">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h2>{user.name}</h2>
            <p className="muted">{user.email}</p>
          </div>
        </div>
        {demo ? (
          <div className="alert">
            Akun demo lokal. Tidak menggunakan kata sandi atau verifikasi email.
            Integrasi Supabase diperlukan untuk akun produksi.
          </div>
        ) : (
          <div className="form-stack">
            <label>
              Nama tampilan
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </label>
            <button
              className="button primary"
              onClick={async () => {
                if (!authClient) return;
                const { error } = await authClient.auth.updateUser({
                  data: { display_name: name },
                });
                setMessage(
                  error?.message ||
                    "Profil tersimpan. Muat ulang untuk melihat nama baru.",
                );
              }}
            >
              Simpan profil
            </button>
            {message && <p role="status">{message}</p>}
          </div>
        )}
        {isMainAdmin(user.email) && <ManagedAccounts />}
        <hr />
        <button className="button secondary" onClick={() => void logout()}>
          <LogOut size={17} /> Keluar dari akun
        </button>
      </section>
    </div>
  );
}
function ManagedAccounts() {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setAccounts(await api<User[]>("admin/accounts"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  return (
    <section className="managed-accounts form-stack">
      <hr />
      <h2>Kelola akun</h2>
      <p>
        Hanya admin utama yang dapat membuat akun atau memberi akses Fun Liga.
        Tidak ada pendaftaran mandiri.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const result = await api<{ created: boolean }>("admin/accounts", {
              method: "POST",
              body: JSON.stringify({ email, name, password }),
            });
            setPassword("");
            setEmail("");
            setName("");
            setMessage(
              result.created
                ? "Akun dibuat. Pengguna dapat masuk dengan email dan kata sandi awal yang Anda tetapkan."
                : "Akses akun yang sudah ada diaktifkan. Kata sandi lamanya tetap berlaku; kata sandi awal di formulir ini tidak menggantikannya.",
            );
            await load();
          } catch (e) {
            setPassword("");
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nama pengguna
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            disabled={busy}
          />
        </label>
        <label>
          Email akun
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            maxLength={200}
            required
            disabled={busy}
          />
        </label>
        <label>
          Kata sandi awal
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={busy}
          />
        </label>
        <small>
          Minimal 8 karakter. Jika email sudah memiliki akun, hanya akses Fun
          Liga yang ditambahkan; kata sandi dan verifikasi lama tetap berlaku.
        </small>
        <button className="button primary full" disabled={busy}>
          {busy ? "Menyimpan…" : "Buat akun / beri akses"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <h3>Akun dengan akses Fun Liga</h3>
      <div className="managed-account-list">
        {accounts.map((account) => (
          <div key={account.id}>
            <b>{account.name}</b>
            <small>{account.email}</small>
            {isMainAdmin(account.email) && (
              <span className="badge">Admin utama</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
function InviteAccept({
  token,
  user,
  login,
  notify,
}: {
  token: string;
  user: User | null;
  login: () => void;
  notify: (s: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="page narrow-page">
      <section className="panel padded">
        <span className="creation-aside-icon">
          <Users size={28} />
        </span>
        <h1>Selamat datang di tim panitia.</h1>
        <p className="muted">
          Terima undangan untuk membantu mengelola kompetisi. Undangan harus
          masih berlaku dan sesuai email Anda.
        </p>
        {error && <div className="alert error">{error}</div>}
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            if (!user) {
              login();
              return;
            }
            setBusy(true);
            try {
              const c = await api<Competition>("invite", {
                method: "POST",
                body: JSON.stringify({ token }),
              });
              notify("Undangan diterima");
              router.push(`/dashboard/competitions/${c.id}`);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Memproses…"
            : user
              ? "Terima undangan"
              : "Masuk untuk menerima"}
          <ArrowRight size={17} />
        </button>
      </section>
    </div>
  );
}
function Help() {
  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> PLAYBOOK
          </div>
          <h1>Siap untuk kick-off?</h1>
          <p>Panduan singkat untuk panitia dan penonton.</p>
        </div>
      </div>
      {[
        {
          title: "01 — Buat kompetisi",
          text: "Masuk, pilih format, lalu masukkan nama tim. Fourfeo memakai tepat empat tim dengan jumlah pertemuan yang bisa Anda tentukan.",
        },
        {
          title: "02 — Tinjau dan publikasikan",
          text: "Kompetisi dimulai sebagai draft. Atur urutan dan waktu pertandingan, lalu publikasikan. Publik muncul di Jelajahi; tautan saja dibuka melalui link; privat hanya untuk panitia.",
        },
        {
          title: "03 — Catat permainan",
          text: "Mulai LIVE untuk mencatat skor selama pertandingan, atau masukkan hasil final langsung. Konfirmasi final untuk menghitung klasemen. Koreksi hasil membutuhkan alasan dan dicatat dalam audit.",
        },
        {
          title: "04 — Bekerja bersama",
          text: "Undang admin atau operator skor melalui tautan yang berlaku 72 jam. Operator hanya bisa mengelola skor, bukan aturan dan anggota.",
        },
        {
          title: "Tentang demo lokal",
          text: "Demo menggunakan SQLite dan akun tanpa kata sandi. Data tersimpan pada mesin ini. Demo tidak aman untuk deployment publik; gunakan Supabase Auth, migrasi database, dan konfigurasi environment untuk produksi.",
        },
      ].map((f) => (
        <section className="panel padded help-card" key={f.title}>
          <h2>{f.title}</h2>
          <p>{f.text}</p>
        </section>
      ))}
    </div>
  );
}

function RulesEditor({
  c,
  command,
}: {
  c: Competition;
  command: (data: Record<string, unknown>) => Promise<Competition>;
}) {
  const { register, getValues } = useForm({ defaultValues: c.rules });
  const [preview, setPreview] = useState<{
    rules: Competition["rules"];
    matches: Match[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const review = () => {
    setError("");
    try {
      const rules = getValues();
      competitionInput.parse({
        ...rules,
        name: c.name,
        format: c.format,
        teamNames: c.teams.map((t) => t.name),
      });
      const teams =
        c.format.includes("group") && rules.groups !== c.rules.groups
          ? c.teams.map((t, i) => ({
              ...t,
              group: String.fromCharCode(65 + (i % rules.groups)),
            }))
          : c.teams;
      setPreview({ rules, matches: generateFixtures({ ...c, teams, rules }) });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <details className="advanced">
      <summary>
        Aturan pertandingan <Settings2 size={16} />
      </summary>
      {c.status !== "draft" ? (
        <div className="alert">
          Aturan terkunci setelah publikasi untuk menjaga riwayat hasil. Poin
          menang / seri / kalah: {c.rules.win} / {c.rules.draw} / {c.rules.loss}
          . Pertemuan: {c.rules.meetings}.
        </div>
      ) : (
        <div className="form-stack">
          {c.format !== "knockout" && (
            <label>
              Pertemuan per pasangan
              <input
                type="number"
                min={1}
                max={10}
                {...register("meetings", { valueAsNumber: true })}
              />
            </label>
          )}
          <div className="three-cols">
            {(["win", "draw", "loss"] as const).map((key, i) => (
              <label key={key}>
                {["Menang", "Seri", "Kalah"][i]}
                <input
                  type="number"
                  min={0}
                  max={20}
                  {...register(key, { valueAsNumber: true })}
                />
              </label>
            ))}
          </div>
          {c.format.includes("group") && (
            <div className="two-cols">
              <label>
                Jumlah grup
                <input
                  type="number"
                  min={1}
                  max={8}
                  {...register("groups", { valueAsNumber: true })}
                />
              </label>
              {c.format === "group_then_knockout" && (
                <label>
                  Tim lolos per grup
                  <input
                    type="number"
                    min={1}
                    max={8}
                    {...register("qualifiers", { valueAsNumber: true })}
                  />
                </label>
              )}
            </div>
          )}
          <label className="checkbox">
            <input type="checkbox" {...register("ranking")} /> Tampilkan
            klasemen
          </label>
          {c.format.includes("knockout") && (
            <label className="checkbox">
              <input type="checkbox" {...register("thirdPlace")} /> Perebutan
              tempat ketiga
            </label>
          )}
          {error && <div className="alert error">{error}</div>}
          <button type="button" className="button secondary" onClick={review}>
            Tinjau aturan & jadwal baru
          </button>
        </div>
      )}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Konfirmasi aturan baru"
        description="Jadwal draft dibuat ulang. Waktu dan urutan manual perlu ditinjau kembali."
      >
        <div className="form-stack">
          <div className="review-banner">
            <CalendarDays size={25} />
            <div>
              <h3>{preview?.matches.length} pertandingan</h3>
              <p>
                Sebelumnya {c.matches.length} · {preview?.rules.meetings}×
                pertemuan
              </p>
            </div>
          </div>
          <p className="muted">
            Poin: {preview?.rules.win} menang / {preview?.rules.draw} seri /{" "}
            {preview?.rules.loss} kalah.
            {c.format.includes("group")
              ? " Jika jumlah grup berubah, alokasi tim diatur ulang secara seimbang."
              : ""}
          </p>
          <div className="preview-pairs">
            {preview?.matches.slice(0, 6).map((m) => (
              <div key={m.id}>
                <span>
                  {c.teams.find((t) => t.id === m.home)?.name ||
                    "Pemenang sebelumnya"}
                </span>
                <small>vs</small>
                <span>
                  {c.teams.find((t) => t.id === m.away)?.name ||
                    "Pemenang sebelumnya"}
                </span>
              </div>
            ))}
          </div>
          {error && <div className="alert error">{error}</div>}
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              if (!preview) return;
              setBusy(true);
              try {
                await command({
                  type: "rules",
                  rules: preview.rules,
                  confirm: true,
                });
                setPreview(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Menyimpan…" : "Konfirmasi aturan & buat ulang jadwal"}
          </button>
        </div>
      </Modal>
    </details>
  );
}
