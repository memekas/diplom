// Server Component (no "use client", no prisma): receives the flattened match
// list, derives the serializable bracket payload (depth-from-final round labels,
// per-pair set-tally derived from m.sets, champion name from the final), and
// delegates all rendering + interaction to the BracketScrollClient leaf.
//
// SCORE CONTRACT (UI-08): set-tally per pair is DERIVED (count of sets the pair
// won), shown inline; per-set GAMES live only in a hover/tap popover (the leaf);
// there is NO final score anywhere; the champion banner shows the NAME only.

import "./bracket.css";
import { BracketScrollClient } from "./bracket-scroll-client";
import type { BracketRound } from "./bracket-scroll-client";

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

// Label by distance from the final (tennis/padel round names).
// depth 0 = final; appends a muted ×N when the round has more than one match.
function roundLabel(round: number, totalRounds: number): string {
  const depth = totalRounds - round;
  if (depth === 0) return "Финал";
  if (depth === 1) return "Полуфинал";
  if (depth === 2) return "Четвертьфинал";
  if (depth === 3) return "1/8 финала";
  return `1/${2 ** depth} финала`;
}

// Set-tally derived from per-set games: pair-A wins a set when its games exceed
// pair-B's, and vice-versa. Mirror of the sketch tallyOf().
function tallyOf(sets: { gamesPair1: number; gamesPair2: number }[]): [number, number] {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.gamesPair1 > s.gamesPair2) a++;
    else if (s.gamesPair2 > s.gamesPair1) b++;
  }
  return [a, b];
}

export function BracketView({ matches }: { matches: BracketMatch[] }) {
  if (matches.length === 0) return null;

  // Champion = the winner of the final match (the one with no parent).
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
  const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  const totalRounds = roundNumbers.length;

  const rounds: BracketRound[] = roundNumbers.map((round) => {
    const roundMatches = (byRound.get(round) ?? []).sort(
      (a, b) => a.position - b.position,
    );
    return {
      label: roundLabel(round, totalRounds),
      isFinal: round === totalRounds,
      count: roundMatches.length,
      matches: roundMatches.map((m) => {
        const [tallyA, tallyB] = tallyOf(m.sets);
        const hasSets = m.sets.length > 0;
        return {
          id: m.id,
          // never show a final score: drop tally + popover sets on the final
          isFinal: m.nextMatchId === null,
          slotA: {
            name: m.pairAName,
            tally: hasSets && m.nextMatchId !== null ? tallyA : null,
            isWinner: m.pairAId !== null && m.pairAId === m.winnerId,
          },
          slotB: {
            name: m.pairBName,
            tally: hasSets && m.nextMatchId !== null ? tallyB : null,
            isWinner: m.pairBId !== null && m.pairBId === m.winnerId,
          },
          sets:
            m.nextMatchId !== null
              ? m.sets.map((s) => ({ a: s.gamesPair1, b: s.gamesPair2 }))
              : [],
        };
      }),
    };
  });

  return <BracketScrollClient rounds={rounds} championName={championName} />;
}
