import Link from "next/link";
import { prisma } from "@/lib/db";
import { listTournaments } from "@/lib/services/tournament";
import { formatLabels, tournamentKindLabels, skillLevelLabels } from "@/lib/validation/auth";

// Home — public async Server Component (NO auth guard). Entry point to Core Value:
// shows tournaments currently OPEN for registration (status="registration") so a
// visitor sees what they can join and links straight to the detail page. Reads via
// the Plan-01/02 service (server-side `where` filter) → Prisma never hits the client.
export default async function Home() {
  const tournaments = await listTournaments(prisma, { status: "registration" });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Открытые турниры</h1>
        <p className="mt-2 text-sm opacity-70">Турниры, открытые для регистрации.</p>
      </header>

      {tournaments.length === 0 ? (
        <p className="rounded-md border border-current/15 px-4 py-8 text-center text-sm opacity-70">
          Сейчас нет открытых турниров.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tournaments/${t.id}`}
                className="flex flex-col gap-2 rounded-md border border-current/15 px-4 py-3 hover:opacity-80"
              >
                <span className="font-medium">{t.name}</span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm opacity-70">
                  <span>{formatLabels[t.format as keyof typeof formatLabels]}</span>
                  <span>
                    {tournamentKindLabels[t.participantMode as keyof typeof tournamentKindLabels]}
                  </span>
                  <span>Уровень: {skillLevelLabels[t.level as keyof typeof skillLevelLabels]}</span>
                  <span>{t.size} участников</span>
                  {t.date && <span>{t.date.toLocaleDateString("ru-RU")}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
