"use client";

import { useActionState } from "react";
import { recordResultAction, type RecordResultActionState } from "./actions";

// Interactive leaf only (Pitfall 11): the detail page stays a Server Component, this
// form is the single "use client" boundary. NEVER imports prisma/db. BOTH tournamentId
// and matchId are bound into the action so they are never tampered with from the client
// (T-05-05). Rendered only for admins, only on matches with both pairs filled. Shows up
// to setsPerMatch rows of (gamesPair1, gamesPair2); existing sets pre-fill and are
// editable (MATCH-04). Trailing empty rows are ignored by the server parser.
export function ScoreForm({
  tournamentId,
  matchId,
  setsPerMatch,
  pairAName,
  pairBName,
  existingSets,
}: {
  tournamentId: string;
  matchId: string;
  setsPerMatch: number;
  pairAName: string;
  pairBName: string;
  existingSets: { gamesPair1: number; gamesPair2: number }[];
}) {
  const [state, formAction, pending] = useActionState<RecordResultActionState, FormData>(
    recordResultAction.bind(null, tournamentId, matchId, setsPerMatch),
    null,
  );

  const rows = Array.from({ length: setsPerMatch }, (_, i) => existingSets[i] ?? null);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-3">
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">{pairAName}</span>
        <span className="opacity-70">против</span>
        <span className="font-medium">{pairBName}</span>
      </div>

      {state && state.ok === false && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((row, i) => {
          const n = i + 1;
          return (
            <div key={n} className="flex items-center gap-2 text-sm">
              <span className="w-12 opacity-70">Сет {n}</span>
              <input
                type="number"
                name={`set${n}_a`}
                min={0}
                defaultValue={row?.gamesPair1 ?? ""}
                className="w-16 rounded-md border border-current/30 px-2 py-1"
                aria-label={`${pairAName}, сет ${n}`}
              />
              <span className="opacity-70">:</span>
              <input
                type="number"
                name={`set${n}_b`}
                min={0}
                defaultValue={row?.gamesPair2 ?? ""}
                className="w-16 rounded-md border border-current/30 px-2 py-1"
                aria-label={`${pairBName}, сет ${n}`}
              />
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Сохранение…" : "Сохранить счёт"}
      </button>
    </form>
  );
}
