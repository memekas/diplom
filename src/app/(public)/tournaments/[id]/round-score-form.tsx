"use client";

import { useActionState, useState } from "react";
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
//   "sets"   → free-form rows set{n}_a / set{n}_b (one blank row, add any number)
// The action's typed RU rejects (incl. mexicano stale_pairings
// "следующий раунд уже сформирован") surface verbatim via the {ok:false} branch.
export function RoundScoreForm({
  tournamentId,
  roundMatchId,
  scoringMode,
  teamAName,
  teamBName,
  pointsA,
  pointsB,
}: {
  tournamentId: string;
  roundMatchId: string;
  scoringMode: "sets" | "points";
  teamAName: string;
  teamBName: string;
  pointsA: number | null;
  pointsB: number | null;
}) {
  const [state, formAction, pending] = useActionState<RecordResultActionState, FormData>(
    recordResultAction.bind(null, tournamentId, roundMatchId),
    null,
  );

  // Free-form sets entry: RoundMatch stores no per-set rows (only collapsed
  // pointsA/pointsB), so sets entry starts blank with one row and the admin can add/remove
  // ANY number of sets. The server parser scans set{n}_a/set{n}_b dynamically.
  const [rows, setRows] = useState<{ a: string; b: string }[]>([{ a: "", b: "" }]);
  const update = (i: number, side: "a" | "b", value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [side]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, { a: "", b: "" }]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  return (
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      <div className="player-name" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>{teamAName}</span>
        <span className="vs" style={{ paddingLeft: 0 }}>против</span>
        <span>{teamBName}</span>
      </div>

      {state && state.ok === false && <p className="error">{state.error}</p>}

      {scoringMode === "points" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            name="points_a"
            min={0}
            defaultValue={pointsA ?? ""}
            className="input"
            style={{ width: 72 }}
            aria-label={`${teamAName}, очки`}
          />
          <span className="muted">:</span>
          <input
            type="number"
            name="points_b"
            min={0}
            defaultValue={pointsB ?? ""}
            className="input"
            style={{ width: 72 }}
            aria-label={`${teamBName}, очки`}
          />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((row, i) => {
              const n = i + 1;
              return (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="label" style={{ width: 48 }}>Сет {n}</span>
                  <input
                    type="number"
                    name={`set${n}_a`}
                    min={0}
                    value={row.a}
                    onChange={(e) => update(i, "a", e.target.value)}
                    className="input"
                    style={{ width: 72 }}
                    aria-label={`${teamAName}, сет ${n}`}
                  />
                  <span className="muted">:</span>
                  <input
                    type="number"
                    name={`set${n}_b`}
                    min={0}
                    value={row.b}
                    onChange={(e) => update(i, "b", e.target.value)}
                    className="input"
                    style={{ width: 72 }}
                    aria-label={`${teamBName}, сет ${n}`}
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="btn btn-ghost"
                      style={{ padding: "6px 10px" }}
                      aria-label={`Удалить сет ${n}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addRow}
            className="btn btn-ghost"
            style={{ justifySelf: "start", padding: "8px 13px" }}
          >
            + Добавить сет
          </button>
        </>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Сохранение…" : "Сохранить счёт"}
      </button>
    </form>
  );
}
