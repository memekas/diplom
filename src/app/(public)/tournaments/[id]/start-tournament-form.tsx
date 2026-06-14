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
      <p className="muted" style={{ fontSize: ".85rem", marginTop: 4 }}>
        Для старта нужно ровно {size} пар (сейчас {pairCount}).
      </p>
    );
  }

  return (
    <form action={formAction} style={{ display: "grid", gap: 10 }}>
      {state && state.ok === false && <p className="error">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
        {pending ? "Генерация сетки…" : "Старт турнира"}
      </button>
    </form>
  );
}
