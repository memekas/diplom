import Link from "next/link";
import { prisma } from "@/lib/db";
import { listTournaments } from "@/lib/services/tournament";
import {
  tournamentStatuses,
  tournamentFormats,
  participantModes,
  type TournamentStatus,
  type TournamentFormat,
  type ParticipantMode,
} from "@/lib/validation/tournament";
import { skillLevels, formatLabels, tournamentKindLabels, skillLevelLabels, type SkillLevel } from "@/lib/validation/auth";
import { TournamentStatusBadge } from "@/components/tournament-status-badge";
import { FilterBar } from "./filter-bar";
import "./tournaments.css";

// Public Server Component — NO auth guard. The tournament list is visible to
// everyone per CONTEXT. Reads through the Plan-01 service (createdAt desc), so
// Prisma never reaches the client bundle. Next 16: searchParams is a Promise.
//
// FILTERING IS SERVER-SIDE (UI-03): facets are read from searchParams, validated
// against the existing tuples (T-13-06: unknown values drop to undefined = no
// filter), then passed to listTournaments which builds a typed Prisma `where`.
// The existing `?status=` param keeps working unchanged. The client leaf
// (filter-bar.tsx) only manages the popover UI + pushes facets to the URL — it
// never hides rows client-side.

const STATUS_SEAM: Record<TournamentStatus, string> = {
  registration: "s-reg",
  in_progress: "s-prog",
  finished: "s-fin",
};

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; format?: string; level?: string; mode?: string; q?: string; past?: string }>;
}) {
  const sp = await searchParams;

  // Validate every facet against its existing tuple before it reaches Prisma.
  const status = pick<TournamentStatus>(sp.status, tournamentStatuses);
  const format = pick<TournamentFormat>(sp.format, tournamentFormats);
  const level = pick<SkillLevel>(sp.level, skillLevels);
  const mode = pick<ParticipantMode>(sp.mode, participantModes);
  const q = sp.q?.trim() || undefined;
  // Date split: ?past=1 → прошедшие (date desc); иначе актуальные (сегодня→будущее, date asc).
  const past = sp.past === "1";
  const timeframe = past ? "past" : "upcoming";

  const [tournaments, all] = await Promise.all([
    listTournaments(prisma, { status, format, level, participantMode: mode, q, timeframe }),
    listTournaments(prisma, { timeframe }),
  ]);

  // preserve the active facets when toggling past/upcoming
  const toggleParams = new URLSearchParams();
  if (sp.status) toggleParams.set("status", sp.status);
  if (sp.format) toggleParams.set("format", sp.format);
  if (sp.level) toggleParams.set("level", sp.level);
  if (sp.mode) toggleParams.set("mode", sp.mode);
  if (sp.q) toggleParams.set("q", sp.q);
  if (!past) toggleParams.set("past", "1");
  const toggleHref = `/tournaments${toggleParams.toString() ? `?${toggleParams}` : ""}`;

  const total = all.length;
  const shown = tournaments.length;

  return (
    <main className="cq mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <header className="page-head">
        <span className="eyebrow">Padel Pro · {past ? "прошедшие турниры" : "турниры"}</span>
        <div className="ph-row">
          <h1>{past ? "Прошедшие турниры" : "Турниры"}</h1>
          <span className="ph-count">
            <b>{shown}</b> из {total}
          </span>
        </div>
        <Link href={toggleHref} className="muted hover:opacity-80" style={{ display: "inline-block", marginTop: "8px", fontSize: ".88rem" }}>
          {past ? "← Актуальные турниры" : "Показать прошедшие турниры →"}
        </Link>
      </header>

      <FilterBar status={sp.status ?? ""} format={sp.format ?? ""} level={sp.level ?? ""} mode={sp.mode ?? ""} q={sp.q ?? ""} past={past} shown={shown} />

      {tournaments.length === 0 ? (
        <p className="empty">Турниров пока нет.</p>
      ) : (
        <div className="list">
          <div className="list-head">
            <span>Турнир</span>
            <span>Формат / вид</span>
            <span>Уровень</span>
            <span>Места</span>
            <span style={{ textAlign: "right" }}>Взнос</span>
            <span>Статус</span>
            <span />
          </div>
          <div className="list-rows">
            {tournaments.map((t) => {
              const registered = t._count.pairs + t._count.tournamentPlayers;
              const pct = t.size > 0 ? Math.min(100, Math.round((registered / t.size) * 100)) : 0;
              const seam = STATUS_SEAM[t.status as TournamentStatus] ?? "s-reg";
              return (
                <Link key={t.id} href={`/tournaments/${t.id}`} className={`trow ${seam}`}>
                  <div className="tr-main">
                    <div className="tr-name">{t.name}</div>
                    <div className="tr-sub">
                      {t.date ? <span className="mono">{dateFmt.format(t.date)}</span> : null}
                      {t.date && t.location ? <span className="dot" /> : null}
                      {t.location ? <span>{t.location}</span> : null}
                    </div>
                  </div>
                  <div className="tr-fmt">
                    <span className="fmt-tag">{formatLabels[t.format as TournamentFormat] ?? t.format}</span>
                    <span className="tr-mode">{tournamentKindLabels[t.participantMode as ParticipantMode] ?? t.participantMode}</span>
                  </div>
                  <div className="tr-lvl">{skillLevelLabels[t.level as SkillLevel] ?? t.level}</div>
                  <div className="tr-cap">
                    <div className="tr-cap-head">
                      <span className="frac">
                        <span className="mono">{registered}</span>
                        <span className="muted">/{t.size}</span>
                      </span>
                      <span className="faint" style={{ fontSize: ".7rem" }}>{pct}%</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="tr-price">
                    {t.price ? `${t.price} ₽` : <span className="price-free">бесплатно</span>}
                  </div>
                  <div className="tr-status-cell">
                    <TournamentStatusBadge status={t.status} />
                  </div>
                  <div className="tr-go">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
