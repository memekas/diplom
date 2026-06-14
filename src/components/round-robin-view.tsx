// Pure presentational Server Component (no "use client", no prisma) for the
// round_robin format (VIS-01). Renders the per-round matches list + the unit
// standings table built from computeStandings — it NEVER recomputes winners or
// standings (display-only; computeStandings is authoritative — Anti-Pattern guard /
// T-11-09). The .win/.lose side highlight and the .dim losing-score number are PURE
// PRESENTATION of the already-stored points, not a new winner computation.
//
// readOnly + renderEntry: when !readOnly and renderEntry is provided, the view calls
// renderEntry(match) for each UNRECORDED match to inject the score form (Plan 04
// supplies it). The view itself renders NO form.
import type { ReactNode } from "react";
import type { RoundRead, RoundReadMatch } from "@/lib/services/rounds";
import type { UnitStanding } from "@/lib/services/standings";
import "./formats.css";

type Props = {
  rounds: RoundRead[];
  standings: UnitStanding[];
  nameById: Record<string, string>;
  readOnly: boolean;
  renderEntry?: (match: RoundReadMatch) => ReactNode;
};

type Slot = { id: string; name: string } | null;

// Join the non-null members of a team into a " / " label (pairs: 2 members; singles: 1).
function teamLabel(a: Slot, b: Slot): string {
  const names = [a?.name, b?.name].filter((n): n is string => Boolean(n));
  return names.length > 0 ? names.join(" / ") : "—";
}

function isRecorded(m: RoundReadMatch): boolean {
  return m.pointsA != null && m.pointsB != null;
}

export function RoundRobinView({ rounds, standings, nameById, readOnly, renderEntry }: Props) {
  const showEntry = !readOnly && Boolean(renderEntry);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Матчи</h2>
        {rounds.length === 0 ? (
          <p className="text-sm opacity-70">Матчи ещё не сгенерированы</p>
        ) : (
          <div>
            {rounds.map((round) => (
              <div key={round.roundNumber} className="round-block">
                <div className="round-label">
                  <span className="rl-name">Раунд {round.roundNumber}</span>
                </div>
                <div className="matches">
                  {round.matches.map((m) => {
                    // Display-only comparison of the already-stored points — does NOT
                    // recompute a winner; just presents which side/number reads as the win.
                    const aWins = isRecorded(m) && (m.pointsA as number) > (m.pointsB as number);
                    const bWins = isRecorded(m) && (m.pointsB as number) > (m.pointsA as number);
                    return (
                      <div key={m.id} className="mrow">
                        <span className="court">
                          <i></i>Корт {m.courtNumber}
                        </span>
                        <span className="matchup">
                          <span className={`side${aWins ? " win" : bWins ? " lose" : ""}`}>
                            {teamLabel(m.teamA1, m.teamA2)}
                          </span>
                          <span className="mdash">—</span>
                          <span className={`side${bWins ? " win" : aWins ? " lose" : ""}`}>
                            {teamLabel(m.teamB1, m.teamB2)}
                          </span>
                        </span>
                        {isRecorded(m) ? (
                          <span className="score">
                            <span className={`a${bWins ? " dim" : ""}`}>{m.pointsA}</span>
                            <span className="sep">:</span>
                            <span className={`b${aWins ? " dim" : ""}`}>{m.pointsB}</span>
                          </span>
                        ) : showEntry ? (
                          renderEntry!(m)
                        ) : (
                          <span className="await">Ожидает счёта</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {standings.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Турнирная таблица</h2>
          <div className="standings-wrap">
            <div className="standings-scroll">
              <table className="standings">
                <thead>
                  <tr>
                    <th>Место</th>
                    <th>Участник</th>
                    <th>Игр</th>
                    <th>Победы</th>
                    <th>Поражения</th>
                    <th>Очки</th>
                    <th>Разница</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((u, i) => (
                    <tr key={u.unitId} className={i === 0 ? "leader" : i <= 2 ? "podium" : undefined}>
                      <td>
                        <span className="rank">{u.rank}</span>
                      </td>
                      <td className="unit">{nameById[u.unitId] ?? "—"}</td>
                      <td>{u.played}</td>
                      <td>{u.wins}</td>
                      <td>{u.losses}</td>
                      <td className="col-pts">{u.pointsFor}</td>
                      <td
                        className={`diff ${u.pointDiff > 0 ? "pos" : u.pointDiff < 0 ? "neg" : "zero"}`}
                      >
                        {u.pointDiff > 0 ? `+${u.pointDiff}` : u.pointDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
