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
  registration: "bg-green-100 text-green-800",
  in_progress: "bg-amber-100 text-amber-800",
  finished: "bg-gray-200 text-gray-700",
};

function isKnownStatus(status: string): status is TournamentStatus {
  return status in STATUS_LABELS;
}

export function TournamentStatusBadge({ status }: { status: string }) {
  const label = isKnownStatus(status) ? STATUS_LABELS[status] : status;
  const className = isKnownStatus(status)
    ? STATUS_CLASSES[status]
    : "bg-gray-200 text-gray-700";

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
