import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTournament } from "@/lib/services/tournament";
import { TournamentStatusBadge } from "@/components/tournament-status-badge";

// Public Server Component — NO auth guard. Detail page is visible to everyone.
// Next 16: params is a Promise, so it must be awaited. getTournament returns
// null on miss → notFound() renders Next's not-found state (no crash, no 500).
export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournament(prisma, id);

  if (!tournament) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <TournamentStatusBadge status={tournament.status} />
        </div>
      </header>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-32 opacity-70">Размер</dt>
          <dd>{tournament.size} пар</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 opacity-70">Формат</dt>
          <dd>Single-elimination (пары)</dd>
        </div>
        {tournament.date && (
          <div className="flex gap-2">
            <dt className="w-32 opacity-70">Дата</dt>
            <dd>{tournament.date.toLocaleString("ru-RU")}</dd>
          </div>
        )}
        {tournament.location && (
          <div className="flex gap-2">
            <dt className="w-32 opacity-70">Место</dt>
            <dd>{tournament.location}</dd>
          </div>
        )}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-baseline gap-2 text-lg font-semibold">
          Зарегистрированные пары
          <span className="text-sm font-normal opacity-70">
            0/{tournament.size}
          </span>
        </h2>
        {/* Placeholder — pairs registration + this list are filled in Phase 3.
            This phase does NOT query the Pair model. */}
        <p className="rounded-md border border-current/15 px-4 py-6 text-center text-sm opacity-70">
          Пока нет зарегистрированных пар.
        </p>
      </section>
    </main>
  );
}
