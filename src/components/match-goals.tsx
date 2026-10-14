"use client";
import { useId, useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import {
  normalizePlayerName,
  playerNameKey,
  playerStatistics,
  type Competition,
  type Goal,
  type Match,
  type Player,
} from "@/lib/competition";
import { TeamMark } from "./ui";

function PlayerNameInput({
  label,
  value,
  onChange,
  players,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  players: Player[];
  disabled: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = playerNameKey(value);
  const suggestions = players
    .filter((p) => !query || playerNameKey(p.name).includes(query))
    .slice(0, 6);
  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };
  return (
    <div className="player-autocomplete">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={`${id}-options`}
        aria-activedescendant={
          open && suggestions[active] ? `${id}-option-${active}` : undefined
        }
        value={value}
        disabled={disabled}
        maxLength={80}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          setOpen(false);
          onChange(normalizePlayerName(value));
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, suggestions.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          }
          if (e.key === "Enter" && open && suggestions[active]) {
            e.preventDefault();
            select(suggestions[active].name);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <div
          className="player-suggestions"
          id={`${id}-options`}
          role="listbox"
          aria-label={`Saran ${label}`}
        >
          {suggestions.map((p, index) => (
            <button
              type="button"
              role="option"
              aria-selected={active === index}
              id={`${id}-option-${index}`}
              key={p.id}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => select(p.name)}
            >
              <b>{p.name}</b>
              <small>Nama yang pernah dicatat untuk tim ini</small>
            </button>
          ))}
        </div>
      )}
      {query && !players.some((p) => playerNameKey(p.name) === query) && (
        <small>Nama baru — pilih saran jika pemain sudah ada.</small>
      )}
    </div>
  );
}

export function GoalTimeline({
  c,
  match,
  editable = false,
  onEdit,
  onDelete,
}: {
  c: Competition;
  match: Match;
  editable?: boolean;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
}) {
  const team = (id: string) => c.teams.find((t) => t.id === id);
  const baseline = match.goalBaseline ?? {
    home: match.homeScore,
    away: match.awayScore,
  };
  return (
    <section className="goal-timeline">
      <h3>Catatan gol</h3>
      {(match.goals ?? [])
        .slice()
        .reverse()
        .map((goal) => (
          <article className="goal-event" key={goal.id}>
            <strong className="goal-minute">
              {goal.minute === null ? "—" : `${goal.minute}′`}
            </strong>
            <TeamMark team={team(goal.teamId)} size={30} />
            <div className="goal-event-info">
              <b>{goal.scorerName || "Pencetak gol belum diisi"}</b>
              <small>
                {team(goal.teamId)?.name}
                {goal.ownGoal ? " · Gol bunuh diri" : ""}
              </small>
              {goal.ownGoal ? (
                <small>Gol untuk {team(goal.creditedTeamId)?.name}</small>
              ) : goal.assistName ? (
                <small>Assist: {goal.assistName}</small>
              ) : null}
            </div>
            {editable && (
              <div className="goal-event-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Edit gol ${goal.scorerName || "tanpa nama"}`}
                  onClick={() => onEdit?.(goal)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button goal-delete"
                  aria-label={`Hapus gol ${goal.scorerName || "tanpa nama"}`}
                  onClick={() => onDelete?.(goal)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </article>
        ))}
      {!match.goals?.length && (
        <p className="muted">Belum ada gol yang dicatat.</p>
      )}
      {baseline.home + baseline.away > 0 && (
        <p className="legacy-goals-note">
          {baseline.home + baseline.away} gol lama belum memiliki catatan
          pemain. Skor tetap diperhitungkan.
        </p>
      )}
    </section>
  );
}

export function MatchGoals({
  c,
  match,
  disabled,
  busy,
  error,
  send,
}: {
  c: Competition;
  match: Match;
  disabled: boolean;
  busy: boolean;
  error: string;
  send: (data: Record<string, unknown>) => Promise<boolean>;
}) {
  const [teamId, setTeamId] = useState(match.home || "");
  const [scorer, setScorer] = useState("");
  const [assist, setAssist] = useState("");
  const [minute, setMinute] = useState("");
  const [ownGoal, setOwnGoal] = useState(false);
  const [existing, setExisting] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [removing, setRemoving] = useState<Goal | null>(null);
  const [form, setForm] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [hp, setHp] = useState(match.homePenalty?.toString() ?? "");
  const [ap, setAp] = useState(match.awayPenalty?.toString() ?? "");
  const isFinal = match.status === "final";
  const candidates = (c.players ?? []).filter((p) => p.teamId === teamId);
  const selectedTeam = c.teams.find((t) => t.id === teamId);
  const beneficiary = c.teams.find(
    (t) =>
      t.id ===
      (ownGoal ? (teamId === match.home ? match.away : match.home) : teamId),
  );
  const baseline = match.goalBaseline ?? {
    home: match.homeScore,
    away: match.awayScore,
  };
  const legacyCount =
    beneficiary?.id === match.home ? baseline.home : baseline.away;
  const reset = () => {
    setScorer("");
    setAssist("");
    setMinute("");
    setOwnGoal(false);
    setExisting(false);
    setEditing(null);
    setRemoving(null);
    setReason("");
    setConfirmed(false);
  };
  const correction = isFinal
    ? {
        reason,
        confirm: confirmed,
        homePenalty: hp === "" ? null : Number(hp),
        awayPenalty: ap === "" ? null : Number(ap),
      }
    : {};
  const ready =
    !disabled &&
    !busy &&
    (!isFinal || (confirmed && reason.trim().length >= 5));
  const edit = (goal: Goal) => {
    reset();
    setTeamId(goal.teamId);
    setScorer(goal.scorerName);
    setAssist(goal.assistName ?? "");
    setMinute(goal.minute?.toString() ?? "");
    setOwnGoal(goal.ownGoal);
    setEditing(goal);
    setForm(true);
  };
  const save = async () => {
    if (!ready) return;
    const ok = await send({
      type: editing ? "goal_update" : "goal_add",
      goalId: editing?.id,
      teamId,
      scorerName: scorer,
      assistName: ownGoal ? "" : assist,
      minute: minute === "" ? null : Number(minute),
      ownGoal,
      existing: !editing && existing,
      ...correction,
    });
    if (ok) {
      reset();
      setForm(false);
    }
  };
  return (
    <div className="match-goals">
      <div className="goal-team-actions">
        {[match.home, match.away].map((id) => (
          <button
            type="button"
            key={id || "pending"}
            className="button primary"
            disabled={
              disabled ||
              busy ||
              !id ||
              !["scheduled", "live", "final"].includes(match.status)
            }
            onClick={() => {
              reset();
              setTeamId(id!);
              setForm(true);
            }}
          >
            <Plus size={17} /> Gol{" "}
            {c.teams.find((t) => t.id === id)?.name || "Tim"}
          </button>
        ))}
      </div>
      {form && (
        <section className="goal-entry form-stack">
          <div className="goal-entry-heading">
            <h3>{editing ? "Edit catatan gol" : "Catat gol"}</h3>
            <button
              type="button"
              className="icon-button"
              aria-label="Tutup pencatatan gol"
              disabled={busy}
              onClick={() => {
                reset();
                setForm(false);
              }}
            >
              <X size={18} />
            </button>
          </div>
          <label>
            Tim pemain
            <select
              value={teamId}
              disabled={busy}
              onChange={(e) => {
                setTeamId(e.target.value);
                setScorer("");
                setAssist("");
                setExisting(false);
              }}
            >
              {[match.home, match.away].map((id) => (
                <option key={id} value={id!}>
                  {c.teams.find((t) => t.id === id)?.name}
                </option>
              ))}
            </select>
          </label>
          <div className="goal-kind" aria-label="Jenis gol">
            <button
              type="button"
              className={!ownGoal ? "active" : ""}
              disabled={busy}
              onClick={() => {
                setOwnGoal(false);
                setExisting(false);
              }}
            >
              Gol biasa
            </button>
            <button
              type="button"
              className={ownGoal ? "active" : ""}
              disabled={busy}
              onClick={() => {
                setOwnGoal(true);
                setAssist("");
                setExisting(false);
              }}
            >
              Gol bunuh diri
            </button>
          </div>
          {ownGoal && (
            <p className="goal-note">
              Pilih pemain {selectedTeam?.name} yang melakukan gol bunuh diri.
              Skor masuk ke {beneficiary?.name}, tanpa statistik gol atau
              assist.
            </p>
          )}
          <PlayerNameInput
            label={
              ownGoal
                ? "Pemain gol bunuh diri (opsional)"
                : "Pencetak gol (opsional)"
            }
            value={scorer}
            onChange={setScorer}
            players={candidates}
            disabled={busy}
          />
          <p className="goal-note">
            Nama boleh dikosongkan dan dilengkapi nanti. Gol tetap masuk ke skor
            dan klasemen; top skor diperbarui setelah nama diisi.
          </p>
          {!ownGoal && (
            <PlayerNameInput
              label="Assist (opsional)"
              value={assist}
              onChange={setAssist}
              players={candidates.filter(
                (p) => playerNameKey(p.name) !== playerNameKey(scorer),
              )}
              disabled={busy}
            />
          )}
          <label>
            Menit (opsional)
            <input
              type="number"
              min={0}
              max={999}
              value={minute}
              disabled={busy}
              onChange={(e) => setMinute(e.target.value)}
            />
          </label>
          {!editing && legacyCount > 0 && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={existing}
                onChange={(e) => setExisting(e.target.checked)}
                disabled={busy}
              />{" "}
              Lengkapi satu gol lama {beneficiary?.name} (skor tetap)
            </label>
          )}
          <p className="goal-note">
            {editing
              ? "Mengubah nama atau assist tidak mengubah skor. Mengubah tim atau jenis gol menyesuaikan skor."
              : existing
                ? "Catatan ini melengkapi gol lama; skor tidak bertambah."
                : `Skor ${beneficiary?.name} bertambah 1 setelah disimpan.`}
          </p>
        </section>
      )}
      {removing && (
        <section className="goal-entry form-stack">
          <h3>Hapus gol {removing.scorerName || "tanpa nama"}?</h3>
          <p>
            Skor {c.teams.find((t) => t.id === removing.creditedTeamId)?.name}{" "}
            berkurang 1. Catatan assist juga dihapus.
          </p>
        </section>
      )}
      {(form || removing) && isFinal && (
        <div className="goal-correction form-stack">
          <label>
            Alasan koreksi gol *
            <textarea
              value={reason}
              minLength={5}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
            />
          </label>
          {match.stage === "knockout" && (
            <div className="two-cols">
              <label>
                Penalti tuan rumah
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={hp}
                  disabled={busy}
                  onChange={(e) => setHp(e.target.value)}
                />
              </label>
              <label>
                Penalti tamu
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={ap}
                  disabled={busy}
                  onChange={(e) => setAp(e.target.value)}
                />
              </label>
            </div>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy}
            />{" "}
            Saya mengonfirmasi koreksi hasil final dan statistik pemain.
          </label>
        </div>
      )}
      {(form || removing) && error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {form && (
        <button
          type="button"
          className="button primary full goal-save"
          disabled={
            !ready ||
            (!ownGoal &&
              !!normalizePlayerName(scorer) &&
              !!normalizePlayerName(assist) &&
              playerNameKey(scorer) === playerNameKey(assist))
          }
          onClick={() => void save()}
        >
          <Check size={17} />{" "}
          {busy
            ? "Menyimpan…"
            : editing
              ? "Simpan perubahan gol"
              : "Simpan gol"}
        </button>
      )}
      {removing && (
        <div className="two-cols">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={reset}
          >
            Batal hapus gol
          </button>
          <button
            type="button"
            className="button danger"
            disabled={!ready}
            onClick={async () => {
              if (
                await send({
                  type: "goal_delete",
                  goalId: removing.id,
                  ...correction,
                })
              )
                reset();
            }}
          >
            <Trash2 size={16} /> Konfirmasi hapus gol
          </button>
        </div>
      )}
      <GoalTimeline
        c={c}
        match={match}
        editable={
          !disabled &&
          !busy &&
          ["scheduled", "live", "final"].includes(match.status)
        }
        onEdit={edit}
        onDelete={(goal) => {
          reset();
          setForm(false);
          setRemoving(goal);
        }}
      />
    </div>
  );
}

export function PlayerLeaders({ c }: { c: Competition }) {
  const rows = playerStatistics(c);
  const missing = c.matches
    .filter((m) => ["live", "final"].includes(m.status))
    .reduce(
      (sum, m) =>
        sum +
        (m.goalBaseline?.home ?? (m.goals ? 0 : m.homeScore)) +
        (m.goalBaseline?.away ?? (m.goals ? 0 : m.awayScore)) +
        (m.goals ?? []).filter((goal) => !goal.ownGoal && !goal.scorerName)
          .length,
      0,
    );
  return (
    <section className="player-leaders">
      <h2>Statistik pemain</h2>
      <p>
        Gol dan assist dari pertandingan LIVE dan final diperbarui otomatis. Gol
        bunuh diri dan adu penalti tidak dihitung.
      </p>
      {c.matches.some((match) => match.status === "live") && (
        <p className="standings-live" role="status">
          LIVE · Statistik pemain sementara
        </p>
      )}
      {missing > 0 && (
        <p className="legacy-goals-note">
          {missing} gol belum memiliki nama pencetak gol; daftar ini belum
          mencakup gol tersebut.
        </p>
      )}
      <div className="two-cols">
        {(["goals", "assists"] as const).map((metric) => (
          <div className="player-leader-panel" key={metric}>
            <h3>{metric === "goals" ? "Top skor" : "Top assist"}</h3>
            {rows
              .filter((p) => p[metric] > 0)
              .sort(
                (a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name),
              )
              .map((p, index) => (
                <div className="player-leader-row" key={p.id}>
                  <span>{index + 1}</span>
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {c.teams.find((t) => t.id === p.teamId)?.name}
                    </small>
                  </div>
                  <strong>{p[metric]}</strong>
                </div>
              ))}
            {!rows.some((p) => p[metric] > 0) && (
              <p>
                Belum ada {metric === "goals" ? "gol" : "assist"} dengan nama
                pemain yang dicatat.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
