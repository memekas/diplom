import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { getMyTournaments, type DashboardTournament, type MyTournaments } from "@/lib/services/dashboard";
import { getProfile } from "@/lib/services/profile";
import {
  skillLevels,
  skillLevelLabels,
  formatLabels,
  tournamentKindLabels,
} from "@/lib/validation/auth";
import { courtSides, courtSideLabels } from "@/lib/validation/profile";
import {
  tournamentFormats,
  participantModes,
} from "@/lib/validation/tournament";
import { TournamentStatusBadge } from "@/components/tournament-status-badge";
import "./dashboard.css";

// Initials for the identity avatar: first letters of the first two words.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function formatLabel(format: string): string {
  return (tournamentFormats as readonly string[]).includes(format)
    ? formatLabels[format as (typeof tournamentFormats)[number]]
    : format;
}
function kindLabel(mode: string): string {
  return (participantModes as readonly string[]).includes(mode)
    ? tournamentKindLabels[mode as (typeof participantModes)[number]]
    : mode;
}

// Person silhouette glyph for the "одиночный зачёт" role line (005).
function SoloGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// The role line: пара с <partner> (with partner avatar) OR одиночный зачёт.
function RoleLine({ t }: { t: DashboardTournament }) {
  if (t.role === "pair" && t.partnerName) {
    return (
      <div className="tc-role">
        <span className="avatar">{initials(t.partnerName)}</span>
        <span>
          <span className="rk">пара с</span> <b>{t.partnerName}</b>
        </span>
      </div>
    );
  }
  return (
    <div className="tc-role">
      <span className="solo">
        <SoloGlyph />
        Одиночный зачёт
      </span>
    </div>
  );
}

// State-appropriate right column. CTAs target EXISTING routes only.
function CardSide({ t }: { t: DashboardTournament }) {
  const href = `/tournaments/${t.id}`;

  if (t.status === "in_progress") {
    const pct = t.round && t.round.total > 0 ? Math.min(100, (t.round.done / t.round.total) * 100) : 0;
    return (
      <div className="tc-side">
        {t.round ? (
          <div className="tc-round">
            <div className="tr-val mono">
              {t.round.done} / {t.round.total}
            </div>
            <div className="tr-key">Раунд</div>
            <div className="progress">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : null}
        <Link className="btn btn-primary" href={href}>
          К текущему раунду
        </Link>
      </div>
    );
  }

  if (t.status === "finished") {
    return (
      <div className="tc-side">
        <Link className="btn btn-ghost" href={href}>
          Результаты
        </Link>
      </div>
    );
  }

  // registration / upcoming
  return (
    <div className="tc-side">
      <Link className="btn btn-ghost" href={href}>
        Открыть
      </Link>
    </div>
  );
}

function TournamentCard({ t, stateClass }: { t: DashboardTournament; stateClass: string }) {
  return (
    <article className={`tcard ${stateClass}`}>
      <div className="tc-main">
        <div className="tc-top">
          <span className="tc-name">{t.name}</span>
          <TournamentStatusBadge status={t.status} />
        </div>
        <div className="tc-meta">
          <span>{formatLabel(t.format)}</span>
          <span>{kindLabel(t.participantMode)}</span>
          {t.location ? <span>{t.location}</span> : null}
        </div>
        <RoleLine t={t} />
      </div>
      <CardSide t={t} />
    </article>
  );
}

function Section({
  title,
  items,
  stateClass,
}: {
  title: string;
  items: DashboardTournament[];
  stateClass: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="sec">
      <div className="sec-head">
        <span className="eyebrow">{title}</span>
        <span className="sec-count">{items.length}</span>
        <span className="sec-line" />
      </div>
      <div className="tlist">
        {items.map((t) => (
          <TournamentCard key={t.id} t={t} stateClass={stateClass} />
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  // Identity is derived from the signed session cookie only — never from the
  // client (Pitfall 8). Use the shared requireUser() guard (same boundary as
  // profile/admin) so the auth check stays single-sourced. Reading the live
  // session also proves AUTH-02: the name persists across a full reload.
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden")) {
      redirect("/login");
    }
    throw e; // let real (operational) errors hit the error boundary
  }

  // courtSide is NOT a Better Auth additionalField, so it is absent from the
  // session — read it (and the canonical skillLevel) from the User row, exactly
  // as the profile screen does. Participation read is session-scoped to user.id.
  const [profile, my]: [Awaited<ReturnType<typeof getProfile>>, MyTournaments] =
    await Promise.all([getProfile(prisma, user.id), getMyTournaments(prisma, user.id)]);

  const levelLabel =
    profile.skillLevel && (skillLevels as readonly string[]).includes(profile.skillLevel)
      ? skillLevelLabels[profile.skillLevel as (typeof skillLevels)[number]]
      : null;
  const sideLabel = (courtSides as readonly string[]).includes(profile.courtSide)
    ? courtSideLabels[profile.courtSide as (typeof courtSides)[number]]
    : null;

  return (
    <main className="cq w-full flex-1 px-5 py-7">
      <div className="lkA">
        {/* identity header */}
        <header className="head">
          <div className="who">
            <div className="avatar">{initials(user.name)}</div>
            <div className="who-text">
              <div className="who-name">{user.name}</div>
              <div className="who-sub">
                <span className="pill mono">@{profile.nickname}</span>
                {levelLabel ? <span className="pill">уровень {levelLabel}</span> : null}
                {sideLabel ? <span className="pill">{sideLabel.toLowerCase()} сторона</span> : null}
              </div>
            </div>
          </div>
          <div className="head-cta">
            <Link className="btn btn-ghost" href="/profile">
              Профиль
            </Link>
            <Link className="btn btn-primary" href="/tournaments">
              Найти турнир
            </Link>
          </div>
        </header>

        <hr className="net-rule" style={{ marginTop: 22 }} />

        <Section title="Активные" items={my.active} stateClass="is-active" />
        <Section title="Предстоящие" items={my.upcoming} stateClass="is-upcoming" />
        <Section title="Завершённые" items={my.finished} stateClass="is-finished" />

        {my.active.length === 0 && my.upcoming.length === 0 && my.finished.length === 0 ? (
          <div className="empty" style={{ marginTop: 30 }}>
            Вы пока не участвуете ни в одном турнире.{" "}
            <Link href="/tournaments">Найти турнир →</Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
