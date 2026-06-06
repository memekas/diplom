"use client";

import { useActionState } from "react";
import { startTournamentAction, type StartTournamentActionState } from "./actions";

// Interactive leaf only (Pitfall 11): the detail page stays a Server Component,
// this form is the single "use client" boundary. NEVER imports prisma/db.
// tournamentId is bound into the action so it is never tampered with from the
// client. canStart is computed server-side (status===registration && pairs===size);
// when false the button is disabled with a RU hint — but this is cosmetic only, the
// authoritative guards live in generateBracket's transaction (T-04-04/T-04-05).
export function StartTournamentForm({
  tournamentId,
  canStart,
  pairCount,
  size,
}: {
  tournamentId: string;
  canStart: boolean;
  pairCount: number;
  size: number;
}) {
  const [state, formAction, pending] = useActionState<StartTournamentActionState, FormData>(
    startTournamentAction.bind(null, tournamentId),
    null,
  );

  if (!canStart) {
    return (
      <p className="rounded-md border border-current/15 px-4 py-3 text-sm opacity-70">
        Для старта нужно ровно {size} пар (сейчас {pairCount}).
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-3">
      {state && state.ok === false && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Генерация сетки…" : "Старт турнира"}
      </button>
    </form>
  );
}
