"use client";

import { useActionState } from "react";
import { recordResultAction, type RecordResultActionState } from "./actions";

// Interactive leaf only (Pitfall 11): the detail page stays a Server Component, this
// form is the single "use client" boundary. NEVER imports prisma/db. This is the
// ROUND-BASED counterpart to score-form.tsx (playoff) — separate file, score-form is
// untouched. tournamentId AND roundMatchId are bound into the action so they are never
// tampered with from the client (T-11-12); roundMatchId is the RoundMatch id — the
// server dispatcher (recordFormatResult) re-reads format/scoringMode from the DB and
// routes to recordRoundResult, so the client value cannot misroute the write.
//
// Inputs branch by scoringMode:
//   "points" → exactly two fields points_a / points_b
//   "sets"   → up to setsPerMatch rows set{n}_a / set{n}_b (mirror of score-form.tsx)
// The action's typed RU rejects (incl. mexicano stale_pairings
// "следующий раунд уже сформирован") surface verbatim via the {ok:false} branch.
export function RoundScoreForm({
  tournamentId,
  roundMatchId,
  scoringMode,
  setsPerMatch,
  teamAName,
  teamBName,
  pointsA,
  pointsB,
}: {
  tournamentId: string;
  roundMatchId: string;
  scoringMode: "sets" | "points";
  setsPerMatch: number;
  teamAName: string;
  teamBName: string;
  pointsA: number | null;
  pointsB: number | null;
}) {
  const [state, formAction, pending] = useActionState<RecordResultActionState, FormData>(
    recordResultAction.bind(null, tournamentId, roundMatchId, setsPerMatch),
    null,
  );

  // RoundMatch stores no per-set rows (only collapsed pointsA/pointsB) — sets-mode
  // entry is always blank, built purely from setsPerMatch (WR-02).
  const setCount = scoringMode === "sets" ? setsPerMatch : 0;

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-3">
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">{teamAName}</span>
        <span className="opacity-70">против</span>
        <span className="font-medium">{teamBName}</span>
      </div>

      {state && state.ok === false && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}

      {scoringMode === "points" ? (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="number"
            name="points_a"
            min={0}
            defaultValue={pointsA ?? ""}
            className="w-16 rounded-md border border-current/30 px-2 py-1"
            aria-label={`${teamAName}, очки`}
          />
          <span className="opacity-70">:</span>
          <input
            type="number"
            name="points_b"
            min={0}
            defaultValue={pointsB ?? ""}
            className="w-16 rounded-md border border-current/30 px-2 py-1"
            aria-label={`${teamBName}, очки`}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {Array.from({ length: setCount }, (_, i) => {
            const n = i + 1;
            return (
              <div key={n} className="flex items-center gap-2 text-sm">
                <span className="w-12 opacity-70">Сет {n}</span>
                <input
                  type="number"
                  name={`set${n}_a`}
                  min={0}
                  className="w-16 rounded-md border border-current/30 px-2 py-1"
                  aria-label={`${teamAName}, сет ${n}`}
                />
                <span className="opacity-70">:</span>
                <input
                  type="number"
                  name={`set${n}_b`}
                  min={0}
                  className="w-16 rounded-md border border-current/30 px-2 py-1"
                  aria-label={`${teamBName}, сет ${n}`}
                />
              </div>
            );
          })}
        </div>
      )}

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
