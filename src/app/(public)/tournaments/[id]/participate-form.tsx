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
    <form action={formAction} className="cta-form" style={{display:"grid",gap:10,width:"100%",maxWidth:340}}>
      {state && state.ok === false && <p className="error">{state.error}</p>}

      <div className="field">
        <label className="label">Ник партнёра</label>
        <input
          name="player2Nickname"
          type="text"
          required
          autoComplete="off"
          className="input"
        />
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
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
    <form action={formAction} className="cta-form" style={{display:"grid",gap:10,width:"100%",maxWidth:340}}>
      {state && state.ok === false && <p className="error">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
        {pending ? "Регистрация…" : "Участвовать"}
      </button>
    </form>
  );
}
