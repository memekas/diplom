"use client";

import { useActionState } from "react";
import { participateAction, type ParticipateActionState } from "./actions";

// Interactive leaf only (Pitfall 11): the detail page stays a Server Component,
// this form is the single "use client" boundary. NEVER imports prisma/db. partners
// arrive already self-excluded + already-paired-excluded from listEligiblePartners
// (server-side authoritative list). tournamentId is bound into the action so it is
// never tampered with from the client.
export function ParticipateForm({
  tournamentId,
  partners,
}: {
  tournamentId: string;
  partners: { id: string; name: string; courtSide: string }[];
}) {
  const [state, formAction, pending] = useActionState<ParticipateActionState, FormData>(
    participateAction.bind(null, tournamentId),
    null,
  );

  if (partners.length === 0) {
    return (
      <p className="rounded-md border border-current/15 px-4 py-3 text-sm opacity-70">
        Нет доступных партнёров для регистрации.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-3">
      {state && state.ok === false && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Партнёр
        <select
          name="player2Id"
          required
          defaultValue=""
          className="rounded-md border border-current/30 px-3 py-2"
        >
          <option value="" disabled>
            Выберите партнёра…
          </option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Регистрация…" : "Участвовать"}
      </button>
    </form>
  );
}
