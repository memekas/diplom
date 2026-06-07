"use client";

import { useActionState } from "react";
import {
  participateAction,
  participateSingleAction,
  type ParticipateActionState,
} from "./actions";

// Interactive leaf only (Pitfall 11): the detail page stays a Server Component,
// this form is the single "use client" boundary. NEVER imports prisma/db. REG-04:
// the partner is entered by exact nickname (no user list offered) and resolved to a
// userId server-side. tournamentId is bound into the action so it is never tampered
// with from the client.
export function ParticipateForm({ tournamentId }: { tournamentId: string }) {
  const [state, formAction, pending] = useActionState<ParticipateActionState, FormData>(
    participateAction.bind(null, tournamentId),
    null,
  );

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-3">
      {state && state.ok === false && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Ник партнёра
        <input
          name="player2Nickname"
          type="text"
          required
          autoComplete="off"
          className="rounded-md border border-current/30 px-3 py-2"
        />
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

// Singles registration (REG-06). No client-supplied fields — registerSingleSchema is
// empty, identity comes from the session server-side. tournamentId is bound into the
// action so it is never tampered with from the client. Typed RU rejects (level_mismatch
// / wrong_mode / tournament_full / already_registered) surface verbatim. NEVER imports
// prisma/db. The detail page picks this vs ParticipateForm by tournament.participantMode.
export function SingleParticipateForm({ tournamentId }: { tournamentId: string }) {
  const [state, formAction, pending] = useActionState<ParticipateActionState, FormData>(
    participateSingleAction.bind(null, tournamentId),
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
        {pending ? "Регистрация…" : "Участвовать"}
      </button>
    </form>
  );
}
