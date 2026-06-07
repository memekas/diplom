import type { TournamentStatus } from "@/lib/validation/tournament";

// Pure presentational Server Component (no "use client"): maps a tournament
// status to its Russian UI label + a distinct Tailwind pill, reusing the
// rounded/colored-pill style from profile-form for visual consistency.
// Accepts a plain string (DB stores status as String) and falls back to the
// raw value for any unexpected status rather than crashing.
const STATUS_LABELS: Record<TournamentStatus, string> = {
  registration: "Регистрация открыта",
  in_progress: "Идёт",
  finished: "Завершён",
};

const STATUS_CLASSES: Record<TournamentStatus, string> = {
  registration: "bg-green-900/40 text-green-300",
  in_progress: "bg-amber-900/40 text-amber-200",
  finished: "bg-white/10 text-foreground/70",
};

function isKnownStatus(status: string): status is TournamentStatus {
  return status in STATUS_LABELS;
}

export function TournamentStatusBadge({ status }: { status: string }) {
  const label = isKnownStatus(status) ? STATUS_LABELS[status] : status;
  const className = isKnownStatus(status)
    ? STATUS_CLASSES[status]
    : "bg-white/10 text-foreground/70";

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
