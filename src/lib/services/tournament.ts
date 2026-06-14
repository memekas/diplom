import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CreateTournamentInput,
  TournamentFormat,
  TournamentStatus,
  ParticipantMode,
} from "@/lib/validation/tournament";
import type { SkillLevel } from "@/lib/validation/auth";

// Tournament domain logic over Prisma. Service takes the prisma client in (actions
// stay thin), like profile.ts. All Tournament columns are public (no credential
// leak concern) but we keep an explicit `select` for consistency + stability.
const tournamentSelect = {
  id: true,
  name: true,
  size: true,
  status: true,
  date: true,
  location: true,
  format: true,
  participantMode: true,
  level: true,
  price: true,
  scoringMode: true,
  targetPoints: true,
  totalRounds: true,
  setsPerMatch: true,
  gamesPerSet: true,
  createdAt: true,
} as const;

// Read-only facet shape for the public list filter (UI-03). Each field is typed
// against the existing validation tuples; the page validates raw searchParams
// against the same tuples before passing them in (T-13-06). Absent/undefined =
// no filter on that facet (preserves the bare `?status=` backward-compat path).
export type ListTournamentsFilter = {
  status?: TournamentStatus;
  format?: TournamentFormat;
  level?: SkillLevel;
  participantMode?: ParticipantMode;
  q?: string;
  // Date split: "upcoming" = сегодня и в будущем (или без даты), сортировка по дате
  // по возрастанию; "past" = строго раньше сегодняшнего дня («как бы завершено»),
  // сортировка по дате по убыванию (новые → старые). Undefined → старое поведение
  // (createdAt desc, без фильтра по дате).
  timeframe?: "upcoming" | "past";
};

// Local midnight today — boundary between "past" and "upcoming/today".
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Adds the registered-count for the capacity «X/size» cue. Read-only — no schema,
// no writes. A pairs tournament fills `pairs`; a singles tournament fills
// `tournamentPlayers`; only one is non-zero so summing is safe.
const tournamentListSelect = {
  ...tournamentSelect,
  _count: { select: { pairs: true, tournamentPlayers: true } },
} as const;

export async function createTournament(prisma: PrismaClient, data: CreateTournamentInput) {
  // status is hard-set to "registration" server-side — NEVER taken from input
  // (Pitfall 4 / threat T-02-02).
  return prisma.tournament.create({
    data: {
      name: data.name,
      size: data.size,
      status: "registration",
      date: data.date ?? null,
      location: data.location ?? null,
      format: data.format,
      participantMode: data.participantMode,
      level: data.level,
      price: data.price ?? null,
      scoringMode: data.scoringMode,
      totalRounds: data.totalRounds ?? null,
      // setsPerMatch / gamesPerSet / targetPoints are no longer configurable — scoring is
      // free-form. The columns remain (no migration) and keep their schema defaults.
    },
    select: tournamentSelect,
  });
}

export async function listTournaments(
  prisma: PrismaClient,
  opts?: ListTournamentsFilter,
) {
  // Newest first (CONTEXT: list shows all tournaments, createdAt desc). Read-only
  // facet filter (UI-03): each present facet ANDs into the `where`; an absent facet
  // is omitted (no filter), preserving the bare `?status=` backward-compat path.
  // `q` matches name OR location via Prisma's parameterized typed `contains` (no raw
  // SQL — T-13-06). Returns a `_count` for the capacity «X/size» cue.
  const where: Prisma.TournamentWhereInput = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.format) where.format = opts.format;
  if (opts?.level) where.level = opts.level;
  if (opts?.participantMode) where.participantMode = opts.participantMode;

  // AND-combine the date-split and the search OR so they don't clobber each other's
  // top-level `OR` key.
  const and: Prisma.TournamentWhereInput[] = [];
  if (opts?.timeframe === "past") {
    and.push({ date: { lt: startOfToday() } });
  } else if (opts?.timeframe === "upcoming") {
    // сегодня и в будущем, плюс турниры без даты (они не «в прошлом»).
    and.push({ OR: [{ date: { gte: startOfToday() } }, { date: null }] });
  }
  if (opts?.q) {
    and.push({ OR: [{ name: { contains: opts.q } }, { location: { contains: opts.q } }] });
  }
  if (and.length > 0) where.AND = and;

  // past → новые к старым (date desc); upcoming → сегодня к будущим (date asc, nulls
  // last via createdAt tiebreak); без timeframe → старое поведение createdAt desc.
  const orderBy: Prisma.TournamentOrderByWithRelationInput[] =
    opts?.timeframe === "past"
      ? [{ date: "desc" }, { createdAt: "desc" }]
      : opts?.timeframe === "upcoming"
        ? [{ date: "asc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

  return prisma.tournament.findMany({
    ...(Object.keys(where).length > 0 ? { where } : {}),
    orderBy,
    select: tournamentListSelect,
  });
}

export async function getTournament(prisma: PrismaClient, id: string) {
  // Returns null for a missing id so the detail page can render a not-found state.
  return prisma.tournament.findUnique({
    where: { id },
    select: tournamentSelect,
  });
}
