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
    <form action={formAction} style={{ display: "grid", gap: 6 }}>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-ghost"
        style={{ justifySelf: "start", padding: "6px 12px", fontSize: ".8rem" }}
      >
        {pending ? "Удаление…" : "Удалить"}
      </button>
      {state && state.ok === false && <p className="error">{state.error}</p>}
    </form>
  );
}
