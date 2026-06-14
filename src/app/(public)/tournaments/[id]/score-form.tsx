"use client";

import { useActionState, useState } from "react";
import { recordResultAction, type RecordResultActionState } from "./actions";

// Interactive leaf only (Pitfall 11): the detail page stays a Server Component, this
// form is the single "use client" boundary. NEVER imports prisma/db. BOTH tournamentId
// and matchId are bound into the action so they are never tampered with from the client
// (T-05-05). Rendered only for admins, only on matches with both pairs filled.
//
// Free-form scoring: the admin can add/remove ANY number of set rows and enter ANY
// non-negative integer games per set. Existing sets pre-fill; the server parser scans
// set{n}_a/set{n}_b dynamically. Submits via recordResultAction (setsPerMatch kept in
// the action signature for compatibility but no longer trusted/used).
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

  // Start from existing sets, or one blank row when none recorded yet.
  const [rows, setRows] = useState<{ a: string; b: string }[]>(
    existingSets.length > 0
      ? existingSets.map((s) => ({ a: String(s.gamesPair1), b: String(s.gamesPair2) }))
      : [{ a: "", b: "" }],
  );

  const update = (i: number, side: "a" | "b", value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [side]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, { a: "", b: "" }]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  return (
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      <div className="player-name" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>{pairAName}</span>
        <span className="vs" style={{ paddingLeft: 0 }}>против</span>
        <span>{pairBName}</span>
      </div>

      {state && state.ok === false && <p className="error">{state.error}</p>}

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
                aria-label={`${pairAName}, сет ${n}`}
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
                aria-label={`${pairBName}, сет ${n}`}
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

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Сохранение…" : "Сохранить счёт"}
      </button>
    </form>
  );
}
