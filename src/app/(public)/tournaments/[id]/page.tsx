import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getOptionalSession } from "@/lib/auth-guards";
import { getTournament } from "@/lib/services/tournament";
import {
  skillLevelLabels,
  formatLabels,
  tournamentKindLabels,
} from "@/lib/validation/auth";
import { listTournamentPairs } from "@/lib/services/registration";
import { listBracket } from "@/lib/services/bracket";
import { listRounds, listTournamentPlayers } from "@/lib/services/rounds";
import { computeStandings } from "@/lib/services/standings";
import { TournamentStatusBadge } from "@/components/tournament-status-badge";
import { BracketView } from "@/components/bracket-view";
import { RoundRobinView } from "@/components/round-robin-view";
import { RotationView } from "@/components/rotation-view";
import { ParticipateForm, SingleParticipateForm } from "./participate-form";
import { StartTournamentForm } from "./start-tournament-form";
import { ScoreForm } from "./score-form";
import { RoundScoreForm } from "./round-score-form";
import { RemoveRegistrationForm } from "./remove-registration-form";
import { FinishTournamentForm } from "./finish-tournament-form";

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
  return skillLevelLabels[level as keyof typeof skillLevelLabels] ?? "—";
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

  const session = await getOptionalSession();
  const userId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === "admin";

  const isPairsMode = tournament.participantMode === "pairs";
  const isPlayoff = tournament.format === "playoff";

  // Participant list + capacity branch by mode. Reads only safe-select projections
  // (no birthDate / credential columns — T-11-13).
  const pairs = isPairsMode ? await listTournamentPairs(prisma, id) : [];
  const players = isPairsMode ? [] : await listTournamentPlayers(prisma, id);

  // Visualization branch by format. Playoff stays on listBracket/BracketView; everything
  // else reads listRounds + derives standings (never materialized — T-11-09).
  const matches = isPlayoff ? await listBracket(prisma, id) : [];
  const rounds = isPlayoff ? [] : await listRounds(prisma, id);
  const standings = isPlayoff ? null : await computeStandings(prisma, id);

  // nameById: unitId/userId → display label, fed to the standings table.
  //   - singles formats: id = userId → player name (from round team members + players list)
  //   - pairs round_robin: id = Pair.id → "name1 / name2"
  const nameById: Record<string, string> = {};
  for (const round of rounds) {
    for (const m of round.matches) {
      for (const slot of [m.teamA1, m.teamA2, m.teamB1, m.teamB2]) {
        if (slot) nameById[slot.id] = slot.name;
      }
    }
  }
  for (const p of players) {
    nameById[p.user.id] = p.user.name;
  }
  for (const pair of pairs) {
    nameById[pair.id] = `${pair.player1.name} / ${pair.player2.name}`;
  }

  const registrantCount = isPairsMode ? pairs.length : players.length;
  const isFull = registrantCount >= tournament.size;
  const alreadyRegistered =
    userId !== null &&
    (isPairsMode
      ? pairs.some((p) => p.player1.id === userId || p.player2.id === userId)
      : players.some((p) => p.user.id === userId));

  // readOnly: anonymous/player always read-only; finished is read-only for everyone
  // (VIS-02). Admin during in_progress gets the entry forms.
  const readOnly = !isAdmin || tournament.status === "finished";

  // Round-based entry slot (admin + in_progress only). The view calls this for each
  // UNRECORDED match; otherwise we pass nothing (read-only).
  const renderEntry =
    isAdmin && tournament.status === "in_progress"
      ? (m: (typeof rounds)[number]["matches"][number]) => {
          const teamAName =
            [m.teamA1?.name, m.teamA2?.name].filter(Boolean).join(" / ") || "—";
          const teamBName =
            [m.teamB1?.name, m.teamB2?.name].filter(Boolean).join(" / ") || "—";
          return (
            <RoundScoreForm
              tournamentId={id}
              roundMatchId={m.id}
              scoringMode={tournament.scoringMode as "sets" | "points"}
              setsPerMatch={tournament.setsPerMatch}
              teamAName={teamAName}
              teamBName={teamBName}
              pointsA={m.pointsA}
              pointsB={m.pointsB}
            />
          );
        }
      : undefined;

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
          <dd>
            {tournament.size} {isPairsMode ? "пар" : "участников"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 opacity-70">Формат</dt>
          <dd>{formatLabels[tournament.format as keyof typeof formatLabels] ?? tournament.format}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 opacity-70">Вид</dt>
          <dd>
            {tournamentKindLabels[
              tournament.participantMode as keyof typeof tournamentKindLabels
            ] ?? tournament.participantMode}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 opacity-70">Уровень</dt>
          <dd>{skillLevelLabel(tournament.level)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 opacity-70">Цена</dt>
          <dd>{tournament.price != null ? `${tournament.price} ₽` : "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 opacity-70">Режим подсчёта</dt>
          <dd>{tournament.scoringMode === "sets" ? "Сеты/геймы" : "Очки"}</dd>
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
          {isPairsMode ? "Зарегистрированные пары" : "Зарегистрированные участники"}
          <span className="text-sm font-normal opacity-70">
            {registrantCount}/{tournament.size}
          </span>
        </h2>

        {registrantCount === 0 ? (
          <p className="rounded-md border border-current/15 px-4 py-6 text-center text-sm opacity-70">
            {isPairsMode ? "Пока нет зарегистрированных пар." : "Пока нет зарегистрированных участников."}
          </p>
        ) : isPairsMode ? (
          <ul className="flex flex-col gap-2">
            {pairs.map((pair) => {
              const mine =
                userId !== null &&
                (pair.player1.id === userId || pair.player2.id === userId);
              return (
                <li
                  key={pair.id}
                  className={`flex flex-col gap-2 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-6 ${
                    mine ? "border-foreground" : "border-current/15"
                  }`}
                >
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:gap-6">
                    {[pair.player1, pair.player2].map((player) => (
                      <div key={player.id} className="flex flex-col gap-0.5">
                        <span className="font-medium">{player.name}</span>
                        <span className="text-xs opacity-70">
                          Сторона: {courtSideLabel(player.courtSide)} · Уровень:{" "}
                          {skillLevelLabel(player.skillLevel)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {isAdmin && tournament.status === "registration" && (
                    <RemoveRegistrationForm tournamentId={id} kind="pair" id={pair.id} />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="flex flex-col gap-2">
            {players.map((p) => {
              const mine = userId !== null && p.user.id === userId;
              return (
                <li
                  key={p.id}
                  className={`flex flex-col gap-2 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-6 ${
                    mine ? "border-foreground" : "border-current/15"
                  }`}
                >
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="font-medium">{p.user.name}</span>
                    <span className="text-xs opacity-70">
                      Сторона: {courtSideLabel(p.user.courtSide)} · Уровень:{" "}
                      {skillLevelLabel(p.user.skillLevel)}
                    </span>
                  </div>
                  {isAdmin && tournament.status === "registration" && (
                    <RemoveRegistrationForm tournamentId={id} kind="player" id={p.id} />
                  )}
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
          ) : isPairsMode ? (
            <ParticipateForm tournamentId={id} />
          ) : (
            <SingleParticipateForm tournamentId={id} />
          )}

          {isAdmin && (
            <div className="flex flex-col gap-2 border-t border-current/15 pt-4">
              <h2 className="text-lg font-semibold">Управление турниром</h2>
              <StartTournamentForm
                tournamentId={id}
                canStart={registrantCount === tournament.size}
                pairCount={registrantCount}
                size={tournament.size}
              />
            </div>
          )}
        </section>
      )}

      {/* Visualization — dispatched by format. Playoff path UNCHANGED. */}
      {isPlayoff
        ? matches.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Сетка</h2>
              <BracketView matches={matches} />
            </section>
          )
        : rounds.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Турнир</h2>
              {tournament.format === "round_robin" ? (
                <RoundRobinView
                  rounds={rounds}
                  standings={standings?.kind === "units" ? standings.units : []}
                  nameById={nameById}
                  readOnly={readOnly}
                  renderEntry={renderEntry}
                />
              ) : (
                <RotationView
                  rounds={rounds}
                  standings={standings?.kind === "players" ? standings.players : []}
                  nameById={nameById}
                  readOnly={readOnly}
                  renderEntry={renderEntry}
                />
              )}
            </section>
          )}

      {/* Playoff result entry (UNCHANGED) — admin, in_progress only. */}
      {isPlayoff && isAdmin && tournament.status === "in_progress" && (
        <section className="flex flex-col gap-4 border-t border-current/15 pt-4">
          <h2 className="text-lg font-semibold">Ввод результатов</h2>
          {matches
            .filter((m) => m.pairAId && m.pairBId && m.pairAName && m.pairBName)
            .map((m) => (
              <div key={m.id} className="rounded-md border border-current/15 px-4 py-3">
                <ScoreForm
                  tournamentId={id}
                  matchId={m.id}
                  setsPerMatch={tournament.setsPerMatch}
                  pairAName={m.pairAName as string}
                  pairBName={m.pairBName as string}
                  existingSets={m.sets}
                />
              </div>
            ))}
        </section>
      )}

      {/* Manual finish — admin, in_progress, ALL formats (ADMN-02). */}
      {isAdmin && tournament.status === "in_progress" && (
        <section className="flex flex-col gap-2 border-t border-current/15 pt-4">
          <h2 className="text-lg font-semibold">Завершение турнира</h2>
          <FinishTournamentForm tournamentId={id} />
        </section>
      )}
    </main>
  );
}
