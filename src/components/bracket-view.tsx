// Pure presentational Server Component (no "use client", no prisma): receives the
// flattened match list as a prop and renders the single-elimination bracket as
// left-to-right columns R1→final (BRKT-02). No bracket library — minimal functional
// Tailwind flex. null pair slots render as «TBD» (later-round, not-yet-decided
// slots). winnerId is null in Phase 4 but a highlight hook is wired so Phase 5
// (results) lights up the winning slot with no markup change.

export type BracketMatch = {
  id: string;
  round: number;
  position: number;
  pairAId: string | null;
  pairBId: string | null;
  pairAName: string | null;
  pairBName: string | null;
  winnerId: string | null;
  nextMatchId: string | null;
  setsWonA: number | null;
  setsWonB: number | null;
  sets: { gamesPair1: number; gamesPair2: number }[];
};

function roundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Финал";
  if (round === totalRounds - 1) return "Полуфинал";
  if (round === totalRounds - 2) return "Четвертьфинал";
  return `${round} раунд`;
}

function Slot({
  name,
  pairId,
  winnerId,
}: {
  name: string | null;
  pairId: string | null;
  winnerId: string | null;
}) {
  const isWinner = pairId !== null && pairId === winnerId;
  return (
    <div
      className={`px-3 py-1.5 text-sm ${
        isWinner ? "font-semibold ring-1 ring-foreground" : ""
      } ${name === null ? "opacity-50" : ""}`}
    >
      {name ?? "TBD"}
    </div>
  );
}

// "6:4 3:6 6:2" — per-set games joined; empty when no sets recorded yet.
function setsLabel(sets: { gamesPair1: number; gamesPair2: number }[]): string {
  return sets.map((s) => `${s.gamesPair1}:${s.gamesPair2}`).join(" ");
}

export function BracketView({ matches }: { matches: BracketMatch[] }) {
  if (matches.length === 0) return null;

  // Champion = the winner of the final match (the one with no parent — nextMatchId null).
  const final = matches.find((m) => m.nextMatchId === null);
  let championName: string | null = null;
  if (final?.winnerId) {
    championName =
      final.winnerId === final.pairAId
        ? final.pairAName
        : final.winnerId === final.pairBId
          ? final.pairBName
          : null;
  }

  // Group by round, ordering each round by position ascending.
  const byRound = new Map<number, BracketMatch[]>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  const totalRounds = rounds.length;

  return (
    <div className="flex flex-col gap-4">
    {championName && (
      <p className="rounded-md border border-foreground px-4 py-3 text-sm font-semibold">
        Чемпион: {championName}
      </p>
    )}
    <div className="flex gap-6 overflow-x-auto pb-2">
      {rounds.map((round) => {
        const roundMatches = (byRound.get(round) ?? []).sort(
          (a, b) => a.position - b.position,
        );
        return (
          <div key={round} className="flex min-w-44 flex-col gap-4">
            <h3 className="text-sm font-medium opacity-70">
              {roundLabel(round, totalRounds)}
            </h3>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {roundMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col divide-y divide-current/15 rounded-md border border-current/15"
                >
                  <Slot name={m.pairAName} pairId={m.pairAId} winnerId={m.winnerId} />
                  <Slot name={m.pairBName} pairId={m.pairBId} winnerId={m.winnerId} />
                  {m.sets.length > 0 && (
                    <div className="px-3 py-1 text-xs opacity-70">{setsLabel(m.sets)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
