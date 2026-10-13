"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowUpRight, Shield, Loader2 } from "lucide-react";
import type { Team } from "@/lib/competition";
import { displayTeamColor } from "@/lib/palette";
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content">
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || "Fun Mini Soccer"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Tutup dialog">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Badge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: "Draft",
    published: "Terjadwal",
    in_progress: "Berlangsung",
    completed: "Selesai",
    archived: "Diarsipkan",
    cancelled: "Dibatalkan",
    scheduled: "Terjadwal",
    live: "LIVE",
    final: "Final",
    postponed: "Ditunda",
    public: "Publik",
    private: "Privat",
    unlisted: "Tautan saja",
  };
  return (
    <span className={`badge badge-${status}`}>
      {status === "live" || status === "in_progress" ? (
        <span className="status-dot" />
      ) : null}
      {labels[status] || status}
    </span>
  );
}
export function TeamMark({ team, size = 36 }: { team?: Team; size?: number }) {
  const color = displayTeamColor(team?.color);
  return (
    <span
      className="team-mark"
      style={{
        width: size,
        height: size,
        color,
        background: `${color}20`,
      }}
    >
      <Shield size={size * 0.65} strokeWidth={1.5} />
      <b>{team?.name.slice(0, 1) || "?"}</b>
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Shield size={30} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={24} /> Memuat lapangan Anda…
    </div>
  );
}
export function Arrow() {
  return <ArrowUpRight size={18} />;
}
