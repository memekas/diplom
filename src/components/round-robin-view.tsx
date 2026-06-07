// Pure presentational Server Component (no "use client", no prisma) for the
// round_robin format (VIS-01). Mirrors BracketView's prop-fed, plain-Tailwind,
// dark-theme-safe style. Renders the per-round matches list + the unit standings
// table built from computeStandings — it NEVER recomputes winners or standings
// (display-only; computeStandings is authoritative — Anti-Pattern guard / T-11-09).
//
// readOnly + renderEntry: when !readOnly and renderEntry is provided, the view calls
// renderEntry(match) for each UNRECORDED match to inject the score form (Plan 04
// supplies it). The view itself renders NO form.
import type { ReactNode } from "react";
import type { RoundRead, RoundReadMatch } from "@/lib/services/rounds";
import type { UnitStanding } from "@/lib/services/standings";

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
          <div className="flex flex-col gap-4">
            {rounds.map((round) => (
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
                      {isRecorded(m) ? (
                        <span className="font-semibold tabular-nums">
                          {m.pointsA}:{m.pointsB}
                        </span>
                      ) : showEntry ? (
                        renderEntry!(m)
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {standings.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Турнирная таблица</h2>
          <div className="overflow-x-auto rounded-md border border-current/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-current/15 text-left opacity-70">
                  <th className="px-3 py-2 font-medium">Место</th>
                  <th className="px-3 py-2 font-medium">Участник</th>
                  <th className="px-3 py-2 text-right font-medium">Игр</th>
                  <th className="px-3 py-2 text-right font-medium">Победы</th>
                  <th className="px-3 py-2 text-right font-medium">Поражения</th>
                  <th className="px-3 py-2 text-right font-medium">Очки</th>
                  <th className="px-3 py-2 text-right font-medium">Разница</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-current/15">
                {standings.map((u) => (
                  <tr key={u.unitId}>
                    <td className="px-3 py-2 tabular-nums">{u.rank}</td>
                    <td className="px-3 py-2">{nameById[u.unitId] ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.played}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.losses}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.pointsFor}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.pointDiff}</td>
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
