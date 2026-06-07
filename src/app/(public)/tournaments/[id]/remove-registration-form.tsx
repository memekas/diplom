"use client";

import { useActionState } from "react";
import {
  removeRegistrationAction,
  type RemoveRegistrationActionState,
} from "./actions";

// Interactive leaf only (Pitfall 11): NEVER imports prisma/db. tournamentId, kind, and
// id are ALL bound into the action so a tampered form cannot redirect the delete
// (T-08-08/16). Admin-only UI; the server guard (requireAdmin) is authoritative — hiding
// the button is cosmetic. For singles `id` is the TournamentPlayer row id; for pairs it
// is the Pair id.
export function RemoveRegistrationForm({
  tournamentId,
  kind,
  id,
}: {
  tournamentId: string;
  kind: "pair" | "player";
  id: string;
}) {
  const [state, formAction, pending] = useActionState<RemoveRegistrationActionState, FormData>(
    removeRegistrationAction.bind(null, tournamentId, kind, id),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-current/30 px-3 py-1 text-xs font-medium disabled:opacity-50"
      >
        {pending ? "Удаление…" : "Удалить"}
      </button>
      {state && state.ok === false && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-xs text-red-300">{state.error}</p>
      )}
    </form>
  );
}
