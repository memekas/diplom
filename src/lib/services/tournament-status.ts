import type { PrismaClient } from "@prisma/client";
import { type TournamentStatus } from "@/lib/validation/tournament";

// TOUR-04 status machine. The ONLY allowed edges are the two forward steps:
// registration → in_progress → finished. "finished" is terminal (no outgoing
// edges). No skips (registration→finished), no backward edges, no self-edges.
// Per PITFALLS Pitfall 4, transitions are enforced server-side and the DB is the
// source of truth — the caller's claimed `from` is never trusted.
export const ALLOWED_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  registration: ["in_progress"],
  in_progress: ["finished"],
  finished: [],
};

// Pure guard: true only for the two allowed edges; false for every other ordered
// pair (including identical from/to and any value not in tournamentStatuses).
export function isAllowedTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  const next = ALLOWED_TRANSITIONS[from];
  return Array.isArray(next) && next.includes(to);
}

// Single server-side transition function (framework-agnostic — takes prisma in,
// like profile.ts). Phase 4 (Старт → in_progress) and Phase 5 (финал → finished)
// reuse this exact guard. Re-reads the current DB status and rejects any caller
// whose claimed `from` does not match (threat T-02-01).
export async function transitionTournament(
  prisma: PrismaClient,
  id: string,
  from: TournamentStatus,
  to: TournamentStatus,
) {
  const current = await prisma.tournament.findUniqueOrThrow({
    where: { id },
    select: { id: true, status: true },
  });

  // Client's claimed current state is not trusted — the DB is authoritative.
  if (current.status !== from) {
    throw new Error(
      `Tournament status changed: expected "${from}" but DB has "${current.status}"`,
    );
  }

  if (!isAllowedTransition(from, to)) {
    throw new Error(`Illegal status transition: ${from} → ${to}`);
  }

  return prisma.tournament.update({
    where: { id },
    data: { status: to },
    select: { id: true, status: true },
  });
}
