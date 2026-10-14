"use client";
import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { Modal } from "./ui";
import {
  drawGroups,
  drawBracketSlots,
  qualifiedTeams,
  canDrawKnockout,
  knockout,
  validateBracketSlots,
  type Competition,
  type Team,
} from "@/lib/competition";
type Command = (data: Record<string, unknown>) => Promise<Competition>;

export function GroupDrawing({
  c,
  command,
}: {
  c: Competition;
  command: Command;
}) {
  const [preview, setPreview] = useState<{
    teams: Team[];
    version: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (c.status !== "draft" || !c.format.includes("group")) return null;
  const groups = Array.from({ length: c.rules.groups }, (_, i) =>
    String.fromCharCode(65 + i),
  );
  const stale = !!preview && preview.version !== c.version;
  const minimum =
    c.format === "group_then_knockout" ? Math.max(2, c.rules.qualifiers) : 2;
  const unchanged =
    !!preview &&
    preview.teams.every(
      (team) => team.group === c.teams.find((t) => t.id === team.id)?.group,
    );
  const invalid =
    !!preview &&
    groups.some(
      (group) =>
        preview.teams.filter((team) => team.group === group).length < minimum,
    );
  return (
    <>
      <button
        className="button secondary small"
        onClick={() => {
          setError("");
          setPreview({
            teams: c.teams.map((team) => ({ ...team })),
            version: c.version,
          });
        }}
      >
        Drawing grup
      </button>
      <Modal
        open={!!preview}
        onClose={() => {
          if (!busy) setPreview(null);
        }}
        title="Drawing pembagian grup"
        description="Acak pembagian tim atau pilih grup secara manual sesuai hasil drawing. Perubahan membuat ulang jadwal draft."
      >
        {preview && (
          <div className="form-stack">
            <button
              className="button secondary full"
              disabled={busy || stale}
              onClick={() => {
                setError("");
                setPreview({
                  ...preview,
                  teams: drawGroups(preview.teams, c.rules.groups),
                });
              }}
            >
              <Shuffle size={16} /> Acak grup
            </button>
            <div className="drawing-summary">
              {groups.map((group) => (
                <span key={group}>
                  Grup {group}:{" "}
                  {preview.teams.filter((team) => team.group === group).length}{" "}
                  tim
                </span>
              ))}
            </div>
            <div className="drawing-team-list">
              {preview.teams.map((team) => (
                <label key={team.id}>
                  <span>{team.name}</span>
                  <select
                    aria-label={`Grup untuk ${team.name}`}
                    disabled={busy || stale}
                    value={team.group ?? ""}
                    onChange={(event) =>
                      setPreview({
                        ...preview,
                        teams: preview.teams.map((t) =>
                          t.id === team.id
                            ? { ...t, group: event.target.value }
                            : t,
                        ),
                      })
                    }
                  >
                    {groups.map((group) => (
                      <option key={group} value={group}>
                        Grup {group}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p>
              Jadwal baru tetap bergiliran antargrup dan mengikuti sistem
              putaran kompetisi. Jadwal draft sebelumnya akan diganti.
            </p>
            {invalid && (
              <div className="alert error">
                Setiap grup membutuhkan minimal {minimum} tim.
              </div>
            )}
            {stale && (
              <div className="alert error">
                Data kompetisi berubah. Tutup dan buka kembali drawing sebelum
                menyimpan.
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <button
              className="button primary full"
              disabled={busy || stale || invalid || unchanged}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await command({
                    type: "group_draw",
                    assignments: preview.teams.map(({ id, group }) => ({
                      id,
                      group,
                    })),
                    confirm: true,
                    version: preview.version,
                  });
                  setPreview(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Menyimpan…" : "Terapkan grup & buat ulang jadwal"}
            </button>
            <button
              className="button secondary full"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Batal
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

export function KnockoutDrawing({
  c,
  command,
}: {
  c: Competition;
  command: Command;
}) {
  const [preview, setPreview] = useState<{
    teams: Team[];
    slots: (string | null)[];
    avoidSameGroup: boolean;
    version: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = useMemo(() => {
    if (!preview) return [];
    try {
      return knockout(preview.teams, c.rules.thirdPlace, preview.slots);
    } catch {
      return [];
    }
  }, [preview, c.rules.thirdPlace]);
  if (!["knockout", "group_then_knockout"].includes(c.format)) return null;
  const ready =
    c.format === "knockout" ||
    c.matches
      .filter((m) => m.stage === "group")
      .every((m) => ["final", "cancelled"].includes(m.status));
  const allowed = canDrawKnockout(c);
  const stale = !!preview && preview.version !== c.version;
  let problem = "";
  if (preview)
    try {
      validateBracketSlots(
        preview.teams,
        preview.slots,
        preview.avoidSameGroup,
      );
    } catch (e) {
      problem = (e as Error).message;
    }
  const label = (id: string | null) =>
    preview?.teams.find((team) => team.id === id)?.name ??
    "Bye — langsung lolos";
  const redraw = (avoidSameGroup = preview?.avoidSameGroup ?? true) => {
    if (!preview) return;
    setError("");
    try {
      setPreview({
        ...preview,
        avoidSameGroup,
        slots: drawBracketSlots(preview.teams, avoidSameGroup),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="drawing-entry">
        <button
          className="button secondary small"
          disabled={!allowed || !ready || busy}
          onClick={() => {
            setError("");
            try {
              const teams = qualifiedTeams(c);
              const avoidSameGroup =
                c.knockoutDrawing?.avoidSameGroup ??
                (c.format === "group_then_knockout" && c.rules.groups > 1);
              const slots =
                c.knockoutDrawing?.slots ??
                drawBracketSlots(teams, avoidSameGroup);
              setPreview({ teams, slots, avoidSameGroup, version: c.version });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Drawing bagan gugur
        </button>
        {!ready && (
          <small className="muted">Tersedia setelah fase grup selesai.</small>
        )}
        {!allowed && (
          <small className="muted">
            Bagan terkunci setelah babak gugur dimulai.
          </small>
        )}
        {error && !preview && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
      </div>
      <Modal
        open={!!preview}
        onClose={() => {
          if (!busy) setPreview(null);
        }}
        title="Drawing bagan gugur"
        description="Acak posisi tim lolos atau atur tiap pasangan secara manual mengikuti drawing di lapangan. Hasil fase grup tetap tersimpan."
      >
        {preview && (
          <div className="form-stack">
            {c.format === "group_then_knockout" && c.rules.groups > 1 && (
              <label>
                Aturan babak awal
                <select
                  aria-label="Aturan babak awal"
                  value={preview.avoidSameGroup ? "avoid" : "free"}
                  disabled={busy || stale}
                  onChange={(event) => {
                    setError("");
                    setPreview({
                      ...preview,
                      avoidSameGroup: event.target.value === "avoid",
                    });
                  }}
                >
                  <option value="avoid">Hindari tim dari grup yang sama</option>
                  <option value="free">Bebas sesuai drawing</option>
                </select>
              </label>
            )}
            <button
              className="button secondary full"
              disabled={busy || stale}
              onClick={() => redraw()}
            >
              <Shuffle size={16} /> Acak bagan
            </button>
            <div className="drawing-pairs">
              {Array.from({ length: preview.slots.length / 2 }, (_, pair) => (
                <div className="drawing-pair" key={pair}>
                  <b>Pasangan {pair + 1}</b>
                  {[pair * 2, pair * 2 + 1].map((slot) => (
                    <label key={slot}>
                      <span>
                        {slot % 2 === 0 ? "Tim pertama" : "Tim kedua"}
                      </span>
                      <select
                        aria-label={`Tim ${slot % 2 === 0 ? "pertama" : "kedua"} pasangan ${pair + 1}`}
                        value={preview.slots[slot] ?? "bye"}
                        disabled={busy || stale}
                        onChange={(event) => {
                          const selected =
                            event.target.value === "bye"
                              ? null
                              : event.target.value;
                          const slots = [...preview.slots];
                          const other = slots.findIndex(
                            (id, index) => id === selected && index !== slot,
                          );
                          if (other !== -1) slots[other] = slots[slot];
                          slots[slot] = selected;
                          setError("");
                          setPreview({ ...preview, slots });
                        }}
                      >
                        {preview.teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                            {team.group ? ` · Grup ${team.group}` : ""}
                          </option>
                        ))}
                        {preview.slots.some((id) => id === null) && (
                          <option value="bye">Bye — langsung lolos</option>
                        )}
                      </select>
                    </label>
                  ))}
                  {preview.slots
                    .slice(pair * 2, pair * 2 + 2)
                    .includes(null) && (
                    <small className="muted">
                      {label(
                        preview.slots[pair * 2] ?? preview.slots[pair * 2 + 1],
                      )}{" "}
                      langsung ke babak berikutnya.
                    </small>
                  )}
                </div>
              ))}
            </div>
            <div className="drawing-bracket-preview">
              <h3>Alur menuju final</h3>
              {matches.map((match, index) => {
                const source = (id: string | undefined) => {
                  const i = matches.findIndex((m) => m.id === id);
                  return `${match.sourceOutcome === "loser" ? "Kalah" : "Pemenang"} M${i + 1}`;
                };
                const lastRound = Math.max(...matches.map((m) => m.round));
                return (
                  <div key={match.id}>
                    <small>
                      {match.sourceOutcome === "loser"
                        ? "Tempat ketiga"
                        : match.round === lastRound
                          ? "Final"
                          : `Babak ${match.round}`}{" "}
                      · M{index + 1}
                    </small>
                    <span>
                      {match.home
                        ? label(match.home)
                        : source(match.sourceHome)}{" "}
                      <b>vs</b>{" "}
                      {match.away
                        ? label(match.away)
                        : source(match.sourceAway)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p>
              Memilih tim yang sudah terpasang akan menukar kedua posisi. Jika
              bagan sudah ada, bagan yang belum dimulai akan diganti; slot
              waktunya dipertahankan.
            </p>
            {problem && <div className="alert error">{problem}</div>}
            {stale && (
              <div className="alert error">
                Data kompetisi berubah. Tutup dan buka kembali drawing sebelum
                menyimpan.
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <button
              className="button primary full"
              disabled={busy || stale || !!problem || !allowed}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await command({
                    type: "knockout_draw",
                    slots: preview.slots,
                    avoidSameGroup: preview.avoidSameGroup,
                    confirm: true,
                    version: preview.version,
                  });
                  setPreview(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Menyimpan…" : "Terapkan drawing bagan"}
            </button>
            <button
              className="button secondary full"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Batal
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
