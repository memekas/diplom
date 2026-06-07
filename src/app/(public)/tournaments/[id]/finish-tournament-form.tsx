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
    <form action={formAction} className="flex w-full max-w-md flex-col gap-3">
      {state && state.ok === false && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Завершение…" : "Завершить турнир"}
      </button>
    </form>
  );
}
