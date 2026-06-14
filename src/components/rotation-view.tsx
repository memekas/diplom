// Pure presentational Server Component (no "use client", no prisma) for the
// americano + mexicano rotation formats (VIS-01). Same prop conventions as
// RoundRobinView. Splits matches into "current" (unrecorded) vs "past" (recorded)
// games and renders a player rating table from computeStandings player rows. It NEVER
// recomputes the rating or materializes a next round (the next mexicano round is
// materialized inside recordRoundResult — Anti-Pattern guard / T-11-09). The rating is
// a PURE ladder — no knockout, no advancement boundary, no "advanced" styling.
//
// readOnly + renderEntry: when !readOnly and renderEntry is provided, the view calls
// renderEntry(match) for each UNRECORDED match to inject the score form (Plan 04
// supplies it). The view itself renders NO form.
import type { ReactNode } from "react";
import type { RoundRead, RoundReadMatch } from "@/lib/services/rounds";
import type { PlayerStanding } from "@/lib/services/standings";
import "./formats.css";

type Props = {
  rounds: RoundRead[];
  standings: PlayerStanding[];
  nameById: Record<string, string>;
  readOnly: boolean;
  renderEntry?: (match: RoundReadMatch) => ReactNode;
};

type Slot = { id: string; name: string } | null;

function teamLabel(a: Slot, b: Slot): string {
  const names = [a?.name, b?.name].filter((n): n is string => Boolean(n));
  return names.length > 0 ? names.join(" / ") : "—";
}

function isRecorded(m: RoundReadMatch): boolean {
  return m.pointsA != null && m.pointsB != null;
}

// Initials for the .unit-cell mini-avatar (first letters of up to two name words).
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Keep only rounds that still have at least one match passing `keep`, preserving the
// already round/court-sorted order from listRounds.
function roundsWith(rounds: RoundRead[], keep: (m: RoundReadMatch) => boolean) {
  return rounds
    .map((r) => ({ roundNumber: r.roundNumber, matches: r.matches.filter(keep) }))
    .filter((r) => r.matches.length > 0);
}

export function RotationView({ rounds, standings, nameById, readOnly, renderEntry }: Props) {
  const showEntry = !readOnly && Boolean(renderEntry);

  // current = unrecorded, past = recorded (Pitfall 5). For mexicano only the highest
  // round is materialized at a time, so it naturally ends up as the lone current group.
  const current = roundsWith(rounds, (m) => !isRecorded(m));
  const past = roundsWith(rounds, isRecorded);

  return (
    <div className="flex flex-col gap-8">
      {rounds.length === 0 ? (
        <p className="text-sm opacity-70">Раунды ещё не сгенерированы</p>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">Текущие игры</h2>
            {current.length === 0 ? (
              <p className="text-sm opacity-70">Нет активных игр</p>
            ) : (
              <div>
                {current.map((round) => (
                  <div key={round.roundNumber} className="round-block">
                    <div className="round-label">
                      <span className="rl-name">Раунд {round.roundNumber}</span>
                      <span className="rl-tag">В игре</span>
                    </div>
                    <div className="matches live">
                      {round.matches.map((m) => (
                        <div key={m.id} className="mrow">
                          <span className="court">
                            <i></i>Корт {m.courtNumber}
                          </span>
                          <span className="matchup">
                            <span className="side">{teamLabel(m.teamA1, m.teamA2)}</span>
                            <span className="mdash">—</span>
                            <span className="side">{teamLabel(m.teamB1, m.teamB2)}</span>
                          </span>
                          {showEntry ? (
                            renderEntry!(m)
                          ) : (
                            <span className="await">Ожидает счёта</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">Прошедшие игры</h2>
            {past.length === 0 ? (
              <p className="text-sm opacity-70">Пока нет сыгранных игр</p>
            ) : (
              <div>
                {past.map((round) => (
                  <div key={round.roundNumber} className="round-block">
                    <div className="round-label">
                      <span className="rl-name">Раунд {round.roundNumber}</span>
                    </div>
                    <div className="matches">
                      {round.matches.map((m) => {
                        // Display-only comparison of stored points — no recompute.
                        const aWins = (m.pointsA as number) > (m.pointsB as number);
                        const bWins = (m.pointsB as number) > (m.pointsA as number);
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
                            <span className="score">
                              <span className={`a${bWins ? " dim" : ""}`}>{m.pointsA}</span>
                              <span className="sep">:</span>
                              <span className={`b${aWins ? " dim" : ""}`}>{m.pointsB}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {standings.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Рейтинг игроков</h2>
          <div className="standings-wrap">
            <div className="standings-scroll">
              <table className="standings">
                <thead>
                  <tr>
                    <th>Место</th>
                    <th>Игрок</th>
                    <th>Сыграно</th>
                    <th>Победы</th>
                    <th>Очки</th>
                    <th>Разница</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((p, i) => {
                    const name = nameById[p.userId] ?? "—";
                    return (
                      <tr key={p.userId} className={i === 0 ? "leader" : i <= 2 ? "podium" : undefined}>
                        <td>
                          <span className="rank">{p.rank}</span>
                        </td>
                        <td>
                          <span className="unit-cell">
                            <span className="avatar">{initials(name)}</span>
                            <span className="unit">{name}</span>
                          </span>
                        </td>
                        <td>{p.played}</td>
                        <td>{p.wins}</td>
                        <td className="col-pts">{p.pointsFor}</td>
                        <td
                          className={`diff ${p.pointDiff > 0 ? "pos" : p.pointDiff < 0 ? "neg" : "zero"}`}
                        >
                          {p.pointDiff > 0 ? `+${p.pointDiff}` : p.pointDiff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
