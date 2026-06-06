import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getOptionalSession } from "@/lib/auth-guards";
import { getTournament } from "@/lib/services/tournament";
import { listTournamentPairs, listEligiblePartners } from "@/lib/services/registration";
import { listBracket } from "@/lib/services/bracket";
import { TournamentStatusBadge } from "@/components/tournament-status-badge";
import { BracketView } from "@/components/bracket-view";
import { ParticipateForm } from "./participate-form";
import { StartTournamentForm } from "./start-tournament-form";

// Display-only RU label maps (no logic — PLAYER-02). null/unknown → «—».
function courtSideLabel(side: string | null): string {
  switch (side) {
    case "left":
      return "левая";
    case "right":
      return "правая";
    case "either":
      return "оба";
    default:
      return "—";
  }
}

function skillLevelLabel(level: string | null): string {
  switch (level) {
    case "beginner":
      return "начинающий";
    case "intermediate":
      return "средний";
    case "advanced":
      return "продвинутый";
    case "pro":
      return "профессионал";
    default:
      return "—";
  }
}

// Public Server Component — NO auth guard (anon must still view it; reads the
// optional session via getOptionalSession only). Next 16: params is a Promise.
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

  const pairs = await listTournamentPairs(prisma, id);
  const session = await getOptionalSession();
  const userId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === "admin";

  const matches = await listBracket(prisma, id);

  const isFull = pairs.length >= tournament.size;
  const alreadyRegistered =
    userId !== null &&
    pairs.some((p) => p.player1.id === userId || p.player2.id === userId);

  // Eligible-partner list only needed when an eligible logged-in player can register.
  const canRegister =
    tournament.status === "registration" && userId !== null && !alreadyRegistered && !isFull;
  const partners = canRegister ? await listEligiblePartners(prisma, id, userId) : [];

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
            {pairs.length}/{tournament.size}
          </span>
        </h2>

        {pairs.length === 0 ? (
          <p className="rounded-md border border-current/15 px-4 py-6 text-center text-sm opacity-70">
            Пока нет зарегистрированных пар.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pairs.map((pair) => {
              const mine =
                userId !== null &&
                (pair.player1.id === userId || pair.player2.id === userId);
              return (
                <li
                  key={pair.id}
                  className={`flex flex-col gap-2 rounded-md border px-4 py-3 text-sm sm:flex-row sm:gap-6 ${
                    mine ? "border-foreground" : "border-current/15"
                  }`}
                >
                  {[pair.player1, pair.player2].map((player) => (
                    <div key={player.id} className="flex flex-col gap-0.5">
                      <span className="font-medium">{player.name}</span>
                      <span className="text-xs opacity-70">
                        Сторона: {courtSideLabel(player.courtSide)} · Уровень:{" "}
                        {skillLevelLabel(player.skillLevel)}
                      </span>
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {tournament.status === "registration" && (
        <section className="flex flex-col gap-3">
          {userId === null ? (
            <p className="text-sm">
              <Link href="/login" className="font-medium underline">
                Войдите, чтобы участвовать
              </Link>
            </p>
          ) : alreadyRegistered ? (
            <p className="rounded-md border border-foreground px-4 py-3 text-sm">
              Вы уже зарегистрированы.
            </p>
          ) : isFull ? (
            <p className="rounded-md border border-current/15 px-4 py-3 text-sm opacity-70">
              Турнир заполнен.
            </p>
          ) : (
            <ParticipateForm tournamentId={id} partners={partners} />
          )}

          {isAdmin && (
            <div className="flex flex-col gap-2 border-t border-current/15 pt-4">
              <h2 className="text-lg font-semibold">Управление турниром</h2>
              <StartTournamentForm
                tournamentId={id}
                canStart={pairs.length === tournament.size}
                pairCount={pairs.length}
                size={tournament.size}
              />
            </div>
          )}
        </section>
      )}

      {matches.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Сетка</h2>
          <BracketView matches={matches} />
        </section>
      )}
    </main>
  );
}
