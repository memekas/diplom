"use client";

import { useActionState } from "react";
import {
  finishTournamentAction,
  type FinishTournamentActionState,
} from "./actions";

// Interactive leaf only (Pitfall 11): NEVER imports prisma/db. tournamentId is bound
// into the action so it is never tampered with from the client. Admin-only manual finish
// (ADMN-02, all formats); the server guard (requireAdmin) is authoritative.
export function FinishTournamentForm({ tournamentId }: { tournamentId: string }) {
  const [state, formAction, pending] = useActionState<FinishTournamentActionState, FormData>(
    finishTournamentAction.bind(null, tournamentId),
    null,
  );

  return (
    <form action={formAction} style={{ display: "grid", gap: 10 }}>
      {state && state.ok === false && <p className="error">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Завершение…" : "Завершить турнир"}
      </button>
    </form>
  );
}
