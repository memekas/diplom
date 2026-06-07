// Pure presentational Server Component (no "use client", no prisma) for the
// americano + mexicano rotation formats (VIS-01). Same prop conventions as
// RoundRobinView. Splits matches into "current" (unrecorded) vs "past" (recorded)
// games and renders a player rating table from computeStandings player rows. It NEVER
// recomputes the rating or materializes a next round (the next mexicano round is
// materialized inside recordRoundResult — Anti-Pattern guard / T-11-09).
//
// readOnly + renderEntry: when !readOnly and renderEntry is provided, the view calls
// renderEntry(match) for each UNRECORDED match to inject the score form (Plan 04
// supplies it). The view itself renders NO form.
import type { ReactNode } from "react";
import type { RoundRead, RoundReadMatch } from "@/lib/services/rounds";
import type { PlayerStanding } from "@/lib/services/standings";

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
              <div className="flex flex-col gap-4">
                {current.map((round) => (
                  <div key={round.roundNumber} className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium opacity-70">Раунд {round.roundNumber}</h3>
                    <div className="flex flex-col divide-y divide-current/15 rounded-md border border-current/15">
                      {round.matches.map((m) => (
                        <div key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                          <span className="text-xs opacity-60">Корт {m.courtNumber}</span>
                          <span className="flex-1 min-w-40">
                            {teamLabel(m.teamA1, m.teamA2)}
                            <span className="px-2 opacity-50">—</span>
                            {teamLabel(m.teamB1, m.teamB2)}
                          </span>
                          {showEntry ? renderEntry!(m) : null}
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
              <div className="flex flex-col gap-4">
                {past.map((round) => (
                  <div key={round.roundNumber} className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium opacity-70">Раунд {round.roundNumber}</h3>
                    <div className="flex flex-col divide-y divide-current/15 rounded-md border border-current/15">
                      {round.matches.map((m) => (
                        <div key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                          <span className="text-xs opacity-60">Корт {m.courtNumber}</span>
                          <span className="flex-1 min-w-40">
                            {teamLabel(m.teamA1, m.teamA2)}
                            <span className="px-2 opacity-50">—</span>
                            {teamLabel(m.teamB1, m.teamB2)}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {m.pointsA}:{m.pointsB}
                          </span>
                        </div>
                      ))}
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
          <div className="overflow-x-auto rounded-md border border-current/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-current/15 text-left opacity-70">
                  <th className="px-3 py-2 font-medium">Место</th>
                  <th className="px-3 py-2 font-medium">Игрок</th>
                  <th className="px-3 py-2 text-right font-medium">Сыграно</th>
                  <th className="px-3 py-2 text-right font-medium">Победы</th>
                  <th className="px-3 py-2 text-right font-medium">Очки</th>
                  <th className="px-3 py-2 text-right font-medium">Разница</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-current/15">
                {standings.map((p) => (
                  <tr key={p.userId}>
                    <td className="px-3 py-2 tabular-nums">{p.rank}</td>
                    <td className="px-3 py-2">{nameById[p.userId] ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.played}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.pointsFor}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.pointDiff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
