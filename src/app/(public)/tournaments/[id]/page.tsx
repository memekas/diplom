import Link from "next/link";
import { notFound } from "next/navigation";
import "./tournament.css";
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

// Initials for the start-list .avatar (first letters of up to two name words).
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// «Правая сторона · средний» — capitalized side + lowercase level (002 .player-sub).
function playerSub(side: string | null, level: string | null): string {
  const s = courtSideLabel(side);
  const sideCap = s === "—" ? "—" : s.charAt(0).toUpperCase() + s.slice(1);
  return `${sideCap} сторона · ${skillLevelLabel(level)}`;
}

// Per-format explanation shown via the РЕГЛАМЕНТ .tip tooltip (display-only copy).
const formatTips: Record<string, string> = {
  playoff:
    "Игра на вылет: проигравшая пара выбывает, победители проходят в следующий раунд — до финала.",
  round_robin: "Круговой: каждый играет с каждым, места — по сумме очков.",
  americano:
    "Одиночная ротация: партнёры меняются каждый раунд, очки идут в личный зачёт.",
  mexicano:
    "Одиночная ротация: соперников подбирают по текущему рейтингу, очки идут в личный зачёт.",
};

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

  const formatLabel =
    formatLabels[tournament.format as keyof typeof formatLabels] ?? tournament.format;
  const kindLabel =
    tournamentKindLabels[
      tournament.participantMode as keyof typeof tournamentKindLabels
    ] ?? tournament.participantMode;
  const formatTip = formatTips[tournament.format] ?? formatLabel;
  const unit = isPairsMode ? "пар" : "участников";
  const fillPct = Math.min(100, (registrantCount / tournament.size) * 100);

  return (
    <main className="cq w-full flex-1 p-8">
      <article className="prog-col">
        {/* HERO */}
        <header className="hero">
          <div className="hero-top">
            <span className="eyebrow">Турнир · {formatLabel}</span>
            <TournamentStatusBadge status={tournament.status} />
          </div>
          <h1>{tournament.name}</h1>
          {(tournament.date || tournament.location || tournament.price != null) && (
            <div className="lede">
              {tournament.date && (
                <span>
                  <span className="mono">
                    {tournament.date.toLocaleString("ru-RU")}
                  </span>
                </span>
              )}
              {tournament.location && <span>{tournament.location}</span>}
              {tournament.price != null && (
                <span>
                  Взнос{" "}
                  <span className="mono">{tournament.price} ₽</span>
                  {" "}с пары
                </span>
              )}
            </div>
          )}
        </header>

        <hr className="net-rule" style={{ marginBottom: 30 }} />

        {/* РЕГЛАМЕНТ */}
        <section>
          <div className="eyebrow sec-eyebrow">Регламент</div>
          <div className="card card-pad">
            <div className="meta">
              <div className="meta-row">
                <span className="meta-key">Размер сетки</span>
                <span className="meta-val">
                  {tournament.size} {unit}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Формат</span>
                <span className="meta-val">
                  <span className="tip" tabIndex={0} data-tip={formatTip}>
                    {formatLabel}
                  </span>
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Состав</span>
                <span className="meta-val">{kindLabel}</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Уровень</span>
                <span className="meta-val">{skillLevelLabel(tournament.level)}</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Подсчёт</span>
                <span className="meta-val">
                  {tournament.scoringMode === "sets" ? "Сеты и геймы" : "Очки"}
                </span>
              </div>
              {tournament.price != null && (
                <div className="meta-row">
                  <span className="meta-key">Взнос за пару</span>
                  <span className="meta-val mono">{tournament.price} ₽</span>
                </div>
              )}
              {tournament.date && (
                <div className="meta-row">
                  <span className="meta-key">Дата</span>
                  <span className="meta-val">
                    {tournament.date.toLocaleString("ru-RU")}
                  </span>
                </div>
              )}
              {tournament.location && (
                <div className="meta-row">
                  <span className="meta-key">Место</span>
                  <span className="meta-val">{tournament.location}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* СТАРТОВЫЙ ЛИСТ */}
        <section>
          <div className="cap-head">
            <div className="eyebrow">Стартовый лист</div>
            <div className="cap-count">
              <b>{registrantCount}</b>{" "}
              <span className="muted">
                / {tournament.size} {unit}
              </span>
            </div>
          </div>
          <div className="progress" style={{ marginBottom: 18 }}>
            <span style={{ width: `${fillPct}%` }} />
          </div>

          {registrantCount === 0 ? (
            <div className="empty">
              {isPairsMode
                ? "Пока нет зарегистрированных пар."
                : "Пока нет зарегистрированных участников."}
            </div>
          ) : isPairsMode ? (
            <div className="plist">
              {pairs.map((pair, i) => {
                const mine =
                  userId !== null &&
                  (pair.player1.id === userId || pair.player2.id === userId);
                return (
                  <div key={pair.id} className={`pair${mine ? " is-you" : ""}`}>
                    <div className="pair-seed">{i + 1}</div>
                    <div className="pair-players">
                      {mine && (
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <span className="you-tag">Ваша пара</span>
                        </div>
                      )}
                      <div className="player">
                        <div className="avatar">{initials(pair.player1.name)}</div>
                        <div className="player-text">
                          <div className="player-name">{pair.player1.name}</div>
                          <div className="player-sub">
                            {playerSub(pair.player1.courtSide, pair.player1.skillLevel)}
                          </div>
                        </div>
                      </div>
                      <div className="vs" />
                      <div className="player">
                        <div className="avatar">{initials(pair.player2.name)}</div>
                        <div className="player-text">
                          <div className="player-name">{pair.player2.name}</div>
                          <div className="player-sub">
                            {playerSub(pair.player2.courtSide, pair.player2.skillLevel)}
                          </div>
                        </div>
                      </div>
                      {isAdmin && tournament.status === "registration" && (
                        <RemoveRegistrationForm tournamentId={id} kind="pair" id={pair.id} />
                      )}
                    </div>
                  </div>
                );
              })}
              {!isFull && (
                <div className="empty" style={{ padding: 18 }}>
                  Осталось {tournament.size - registrantCount} свободных мест до жеребьёвки
                </div>
              )}
            </div>
          ) : (
            <div className="plist">
              {players.map((p, i) => {
                const mine = userId !== null && p.user.id === userId;
                return (
                  <div key={p.id} className={`pair${mine ? " is-you" : ""}`}>
                    <div className="pair-seed">{i + 1}</div>
                    <div className="pair-players">
                      {mine && (
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <span className="you-tag">Вы</span>
                        </div>
                      )}
                      <div className="player">
                        <div className="avatar">{initials(p.user.name)}</div>
                        <div className="player-text">
                          <div className="player-name">{p.user.name}</div>
                          <div className="player-sub">
                            {playerSub(p.user.courtSide, p.user.skillLevel)}
                          </div>
                        </div>
                      </div>
                      {isAdmin && tournament.status === "registration" && (
                        <RemoveRegistrationForm tournamentId={id} kind="player" id={p.id} />
                      )}
                    </div>
                  </div>
                );
              })}
              {!isFull && (
                <div className="empty" style={{ padding: 18 }}>
                  Осталось {tournament.size - registrantCount} свободных мест до старта
                </div>
              )}
            </div>
          )}
        </section>

        {/* CTA + ADMIN */}
        {tournament.status === "registration" && (
          <section>
            <div className="card card-pad cta-stack">
              <div className="eyebrow">Участие</div>
              {userId === null ? (
                <p>
                  <Link href="/login">Войдите, чтобы участвовать</Link>
                </p>
              ) : alreadyRegistered ? (
                <p className="muted">Вы уже зарегистрированы.</p>
              ) : isFull ? (
                <p className="muted">Турнир заполнен.</p>
              ) : (
                <div className="cta-row">
                  {tournament.price != null && (
                    <div className="cta-price">
                      {tournament.price} ₽<small>взнос за пару</small>
                    </div>
                  )}
                  {isPairsMode ? (
                    <ParticipateForm tournamentId={id} />
                  ) : (
                    <SingleParticipateForm tournamentId={id} />
                  )}
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="admin-box" style={{ marginTop: 16 }}>
                <div className="eyebrow">Только для организатора</div>
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
              <section>
                <div className="eyebrow sec-eyebrow">Сетка</div>
                <BracketView matches={matches} />
              </section>
            )
          : rounds.length > 0 && (
              <section>
                <div className="eyebrow sec-eyebrow">Турнир</div>
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
          <section>
            <hr className="net-rule" style={{ marginBottom: 18 }} />
            <div className="eyebrow sec-eyebrow">Ввод результатов</div>
            <div className="plist">
              {matches
                .filter((m) => m.pairAId && m.pairBId && m.pairAName && m.pairBName)
                .map((m) => (
                  <div key={m.id} className="card card-pad">
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
            </div>
          </section>
        )}

        {/* Manual finish — admin, in_progress, ALL formats (ADMN-02). */}
        {isAdmin && tournament.status === "in_progress" && (
          <section style={{ marginBottom: 0 }}>
            <hr className="net-rule" style={{ marginBottom: 18 }} />
            <div className="eyebrow sec-eyebrow">Завершение турнира</div>
            <FinishTournamentForm tournamentId={id} />
          </section>
        )}
      </article>
    </main>
  );
}
