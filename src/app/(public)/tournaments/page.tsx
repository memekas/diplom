import Link from "next/link";
import { prisma } from "@/lib/db";
import { listTournaments } from "@/lib/services/tournament";
import { TournamentStatusBadge } from "@/components/tournament-status-badge";

// Public Server Component — NO auth guard. The tournament list is visible to
// everyone (including anonymous visitors) per CONTEXT (path to Core Value).
// Reads directly through the Plan-01 service (createdAt desc), so Prisma never
// reaches the client bundle.
export default async function TournamentsPage() {
  const tournaments = await listTournaments(prisma);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-bold">Турниры</h1>
      </header>

      {tournaments.length === 0 ? (
        <p className="rounded-md border border-current/15 px-4 py-8 text-center text-sm opacity-70">
          Турниров пока нет.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tournaments/${t.id}`}
                className="flex items-center justify-between gap-4 rounded-md border border-current/15 px-4 py-3 hover:opacity-80"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-sm opacity-70">{t.size} пар</span>
                </span>
                <TournamentStatusBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
