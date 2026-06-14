// Demo seed — fills the app with a varied, VALID dataset for the thesis demo.
//
// Creates many tournaments across all 4 formats (playoff / round_robin / americano /
// mexicano), all 5 skill levels, both participant modes, both scoring modes, and all 3
// statuses (registration / in_progress / finished) — by driving the REAL services
// (createTournament / registerPair / registerSingle / startFormat / recordResult /
// recordRoundResult / materializeNextMexicanoRound / finishTournament), so every row is
// business-rule valid. Per-tournament try/catch: one failure never aborts the run.
//
// Users: creates COUNT_PER_LEVEL players per level via Better Auth (idempotent — skips
// existing emails) so level-matched registration always has eligible players. Login:
// <level><n>@padel.local / "12345678" (e.g. intermediate1@padel.local).
//
// Usage:  npx tsx scripts/seed-demo.ts      (run with the dev server stopped or running)
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/db";
import { createTournament } from "../src/lib/services/tournament";
import { registerPair, registerSingle } from "../src/lib/services/registration";
import { startFormat } from "../src/lib/services/format-engine";
import { recordResult } from "../src/lib/services/result";
import { recordRoundResult } from "../src/lib/services/round-result";
import { materializeNextMexicanoRound } from "../src/lib/services/mexicano";
import { finishTournament } from "../src/lib/services/admin";

const PASSWORD = "12345678";
const COUNT_PER_LEVEL = 16; // covers the largest single tournament (playoff size 8 = 16 users)
const LEVELS = ["beginner", "progressing", "intermediate", "advanced", "pro"] as const;
type Level = (typeof LEVELS)[number];

const FIRST = ["Иван","Мария","Алексей","Ольга","Дмитрий","Анна","Сергей","Елена","Павел","Наталья","Андрей","Ирина","Никита","Татьяна","Роман","Юлия","Максим","Екатерина","Артём","Светлана"];
const LAST = ["Петров","Сидорова","Иванов","Кузнецова","Смирнов","Попова","Волков","Морозова","Новиков","Васильева","Фёдоров","Соколова","Зайцев","Орлова","Лебедев","Козлова","Егоров","Павлова","Макаров","Никитина"];
const SIDES = ["left", "right", "either"] as const;

// per-level pool of created/known user ids
const pool: Record<Level, string[]> = { beginner: [], progressing: [], intermediate: [], advanced: [], pro: [] };

async function ensureUsers() {
  for (const level of LEVELS) {
    for (let i = 1; i <= COUNT_PER_LEVEL; i++) {
      const email = `${level}${i}@padel.local`;
      const nickname = `${level}_${i}`;
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        pool[level].push(existing.id);
        continue;
      }
      const name = `${FIRST[(i - 1) % FIRST.length]} ${LAST[(i + LEVELS.indexOf(level)) % LAST.length]}`;
      try {
        await auth.api.signUpEmail({ body: { email, password: PASSWORD, name, nickname, skillLevel: level } });
        const u = await prisma.user.update({
          where: { email },
          data: { courtSide: SIDES[i % 3], phone: i % 2 ? `+7 900 ${String(100 + i).padStart(3, "0")}-00-00` : null },
          select: { id: true },
        });
        pool[level].push(u.id);
      } catch (e) {
        console.warn(`  user ${email} skipped: ${(e as Error).message}`);
      }
    }
    console.log(`users[${level}] = ${pool[level].length}`);
  }
}

// Draw `n` distinct user ids of a level, none already used within this tournament.
function draw(level: Level, n: number, used: Set<string>): string[] {
  const out: string[] = [];
  for (const id of pool[level]) {
    if (out.length >= n) break;
    if (!used.has(id)) { out.push(id); used.add(id); }
  }
  return out;
}

type State = "registration" | "active" | "finished";
interface Spec {
  name: string;
  format: "playoff" | "round_robin" | "americano" | "mexicano";
  participantMode: "pairs" | "singles";
  level: Level;
  scoringMode: "sets" | "points";
  size: number;
  fill: number;           // pairs OR singles to register
  state: State;
  totalRounds?: number;
  price?: number | null;
  location?: string;
  daysFromNow: number;    // negative = past (finished), positive = upcoming
}

const LOCATIONS = ["«Padel Club Москва»", "«Корт №1»", "«Арена Юг»", "«Падел Парк»"];

const SPECS: Spec[] = [
  // ---- REGISTRATION (planned) ----
  { name: "Весенний Кубок", format: "playoff", participantMode: "pairs", level: "intermediate", scoringMode: "sets", size: 8, fill: 6, state: "registration", price: 1500, location: LOCATIONS[0], daysFromNow: 14 },
  { name: "Лига Новичков", format: "round_robin", participantMode: "singles", level: "beginner", scoringMode: "points", size: 6, fill: 4, state: "registration", price: null, location: LOCATIONS[1], daysFromNow: 10 },
  { name: "Американо Вечер", format: "americano", participantMode: "singles", level: "progressing", scoringMode: "points", size: 8, fill: 5, state: "registration", totalRounds: 5, price: 800, location: LOCATIONS[2], daysFromNow: 7 },
  { name: "Мексикано Про", format: "mexicano", participantMode: "singles", level: "pro", scoringMode: "points", size: 8, fill: 8, state: "registration", totalRounds: 4, price: 2500, location: LOCATIONS[0], daysFromNow: 21 },

  // ---- ACTIVE (in_progress) ----
  { name: "Чемпионат Города", format: "playoff", participantMode: "pairs", level: "intermediate", scoringMode: "sets", size: 8, fill: 8, state: "active", price: 2000, location: LOCATIONS[0], daysFromNow: 1 },
  { name: "Кубок Сильнейших", format: "playoff", participantMode: "pairs", level: "advanced", scoringMode: "sets", size: 4, fill: 4, state: "active", price: 1800, location: LOCATIONS[3], daysFromNow: 2 },
  { name: "Круговая Лига", format: "round_robin", participantMode: "pairs", level: "intermediate", scoringMode: "sets", size: 4, fill: 4, state: "active", price: 1200, location: LOCATIONS[1], daysFromNow: 1 },
  { name: "Американо Лето", format: "americano", participantMode: "singles", level: "progressing", scoringMode: "points", size: 4, fill: 4, state: "active", totalRounds: 4, price: null, location: LOCATIONS[2], daysFromNow: 0 },
  { name: "Мексикано Микс", format: "mexicano", participantMode: "singles", level: "intermediate", scoringMode: "points", size: 8, fill: 8, state: "active", totalRounds: 4, price: 1000, location: LOCATIONS[3], daysFromNow: 0 },

  // ---- FINISHED ----
  { name: "Зимний Кубок 2025", format: "playoff", participantMode: "pairs", level: "beginner", scoringMode: "sets", size: 4, fill: 4, state: "finished", price: 1000, location: LOCATIONS[1], daysFromNow: -30 },
  { name: "Гранд Финал", format: "playoff", participantMode: "pairs", level: "pro", scoringMode: "sets", size: 8, fill: 8, state: "finished", price: 3000, location: LOCATIONS[0], daysFromNow: -14 },
  { name: "Круговой Турнир", format: "round_robin", participantMode: "singles", level: "advanced", scoringMode: "points", size: 4, fill: 4, state: "finished", price: 1500, location: LOCATIONS[3], daysFromNow: -20 },
  { name: "Американо Кап", format: "americano", participantMode: "singles", level: "intermediate", scoringMode: "points", size: 4, fill: 4, state: "finished", totalRounds: 4, price: 700, location: LOCATIONS[2], daysFromNow: -10 },
  { name: "Мексикано Опен", format: "mexicano", participantMode: "singles", level: "advanced", scoringMode: "points", size: 8, fill: 8, state: "finished", totalRounds: 3, price: 2200, location: LOCATIONS[0], daysFromNow: -7 },
];

// Record one playoff match decisively (A wins 6:x, 6:y so winnerFromSets is decisive).
async function recordPlayoffMatch(matchId: string, i: number) {
  const aWins = i % 2 === 0;
  const s1 = aWins ? { gamesPair1: 6, gamesPair2: 2 + (i % 4) } : { gamesPair1: 3 + (i % 3), gamesPair2: 6 };
  const s2 = aWins ? { gamesPair1: 6, gamesPair2: 3 } : { gamesPair1: 4, gamesPair2: 6 };
  await recordResult(prisma, matchId, [s1, s2]);
}

// Record one round-based match by scoringMode (decisive).
async function recordRoundMatch(roundMatchId: string, scoringMode: "sets" | "points", i: number) {
  if (scoringMode === "points") {
    const aWins = i % 2 === 0;
    const hi = 21 + (i % 4), lo = 12 + (i % 6);
    await recordRoundResult(prisma, roundMatchId, aWins ? { pointsA: hi, pointsB: lo } : { pointsA: lo, pointsB: hi });
  } else {
    const aWins = i % 2 === 0;
    await recordRoundResult(prisma, roundMatchId, { sets: [aWins ? { gamesPair1: 6, gamesPair2: 2 + (i % 4) } : { gamesPair1: 2 + (i % 4), gamesPair2: 6 }] });
  }
}

async function registerParticipants(spec: Spec, tid: string) {
  const used = new Set<string>();
  if (spec.participantMode === "pairs") {
    for (let p = 0; p < spec.fill; p++) {
      const [a, b] = draw(spec.level, 2, used);
      if (!a || !b) break;
      await registerPair(prisma, { tournamentId: tid, player1Id: a, player2Id: b });
    }
  } else {
    const ids = draw(spec.level, spec.fill, used);
    for (const id of ids) await registerSingle(prisma, { tournamentId: tid, userId: id });
  }
}

async function playOut(spec: Spec, tid: string, finishAll: boolean) {
  await startFormat(prisma, tid); // flips status → in_progress

  if (spec.format === "playoff") {
    let pass = 0;
    const maxPasses = finishAll ? 12 : 1; // active = only round 1
    while (pass < maxPasses) {
      const matches = await prisma.match.findMany({
        where: { tournamentId: tid, winnerId: null, NOT: [{ pairAId: null }, { pairBId: null }] },
        select: { id: true },
      });
      if (matches.length === 0) break;
      let i = 0;
      for (const m of matches) await recordPlayoffMatch(m.id, i++);
      pass++;
    }
    if (finishAll) await finishTournament(prisma, tid);
    return;
  }

  // round-based
  if (spec.format === "mexicano") {
    const rounds = finishAll ? (spec.totalRounds ?? 3) : 2; // active mexicano: round1 recorded + round2 materialized (unrecorded)
    for (let rn = 1; rn <= rounds; rn++) {
      const round = await prisma.round.findUnique({
        where: { tournamentId_roundNumber: { tournamentId: tid, roundNumber: rn } },
        include: { matches: { select: { id: true } } },
      });
      if (!round) break;
      // For active mexicano: record round 1 only; leave round 2 (current games) unrecorded.
      if (!finishAll && rn === 2) break;
      let i = 0;
      for (const rm of round.matches) await recordRoundMatch(rm.id, "points", i++);
      if (rn < rounds) await materializeNextMexicanoRound(prisma, tid, rn);
    }
    if (finishAll) await finishTournament(prisma, tid);
    return;
  }

  // round_robin / americano — all rounds pre-generated
  const allRounds = await prisma.round.findMany({
    where: { tournamentId: tid },
    include: { matches: { select: { id: true } } },
    orderBy: { roundNumber: "asc" },
  });
  const roundsToPlay = finishAll ? allRounds : allRounds.slice(0, 1); // active = round 1 only
  let i = 0;
  for (const round of roundsToPlay) {
    for (const rm of round.matches) await recordRoundMatch(rm.id, spec.scoringMode, i++);
  }
  if (finishAll) await finishTournament(prisma, tid);
}

async function main() {
  console.log("[seed-demo] ensuring per-level users…");
  await ensureUsers();

  let ok = 0, fail = 0;
  for (const spec of SPECS) {
    try {
      const date = new Date(Date.now() + spec.daysFromNow * 86400_000);
      const t = await createTournament(prisma, {
        name: spec.name,
        size: spec.size,
        format: spec.format,
        participantMode: spec.participantMode,
        level: spec.level,
        scoringMode: spec.scoringMode,
        totalRounds: spec.totalRounds ?? null,
        price: spec.price ?? null,
        location: spec.location ?? null,
        date,
      } as Parameters<typeof createTournament>[1]);

      await registerParticipants(spec, t.id);

      if (spec.state === "active") await playOut(spec, t.id, false);
      else if (spec.state === "finished") await playOut(spec, t.id, true);
      // registration → leave as-is (created + registered, not started)

      console.log(`[seed-demo] ✓ ${spec.state.padEnd(12)} ${spec.format.padEnd(11)} ${spec.participantMode.padEnd(7)} ${spec.level.padEnd(12)} "${spec.name}"`);
      ok++;
    } catch (e) {
      console.error(`[seed-demo] ✗ "${spec.name}" (${spec.format}/${spec.state}): ${(e as Error).message}`);
      fail++;
    }
  }

  const counts = await prisma.tournament.groupBy({ by: ["status"], _count: true });
  console.log(`\n[seed-demo] Done. ${ok} ok, ${fail} failed.`);
  console.log("[seed-demo] tournaments by status:", counts.map((c) => `${c.status}=${c._count}`).join("  "));
  console.log(`[seed-demo] login any player: <level><n>@padel.local / "${PASSWORD}" (e.g. intermediate1@padel.local)`);
}

main()
  .catch((err) => { console.error("[seed-demo] Failed:", err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
