// Fill a tournament with random ELIGIBLE players for local development / demo.
//
// Registers eligible players onto an OPEN tournament (status="registration") by id,
// reusing the real registration services (registerPair / registerSingle) so all rules
// (level match, capacity, duplicates, mode) are enforced exactly as in the app — this
// script duplicates NONE of that logic. Eligible = skillLevel === tournament.level,
// role !== "admin", and NOT already registered in this tournament.
//
// Usage:
//   npx tsx scripts/seed-tournament-registrations.ts <cuid>
//   npx tsx scripts/seed-tournament-registrations.ts http://localhost:3000/tournaments/<cuid>
//   npm run seed:tournament-fill -- <cuid>
//
// No-arg → prints all open tournaments (id + name + format + level + size) and exits 1.
// Not enough eligible players → prints a hint to seed more at the right level.
import { prisma } from "../src/lib/db";
import {
  registerPair,
  registerSingle,
  RegistrationError,
} from "../src/lib/services/registration";

// Accept a raw cuid OR a full /tournaments/<id> URL. If it contains "/", take the
// last non-empty path segment after stripping query/hash.
function parseTournamentId(raw: string): string {
  let s = raw.trim();
  // Strip query/hash.
  s = s.split("#")[0].split("?")[0];
  if (s.includes("/")) {
    const segments = s.split("/").filter((seg) => seg.length > 0);
    s = segments[segments.length - 1] ?? "";
  }
  return s;
}

// Fisher–Yates in-place shuffle (Math.random is fine for dev seeding).
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function listOpenTournaments() {
  const open = await prisma.tournament.findMany({
    where: { status: "registration" },
    select: { id: true, name: true, format: true, level: true, size: true, participantMode: true },
    orderBy: { createdAt: "desc" },
  });
  if (open.length === 0) {
    console.log("[seed-tournament-fill] Нет открытых турниров (status=registration).");
    return;
  }
  console.log("[seed-tournament-fill] Открытые турниры (status=registration):");
  for (const t of open) {
    console.log(
      `  ${t.id}  "${t.name}"  format=${t.format} mode=${t.participantMode} level=${t.level} size=${t.size}`,
    );
  }
}

async function main() {
  const rawArg = process.argv[2];
  if (!rawArg || rawArg.trim() === "") {
    console.error("[seed-tournament-fill] Не указан id турнира.");
    console.error("  Использование: npx tsx scripts/seed-tournament-registrations.ts <cuid|url>");
    await listOpenTournaments();
    process.exit(1);
  }

  const tournamentId = parseTournamentId(rawArg);
  if (!tournamentId) {
    console.error(`[seed-tournament-fill] Не удалось извлечь id из "${rawArg}".`);
    process.exit(1);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      format: true,
      participantMode: true,
      level: true,
      size: true,
    },
  });

  if (!tournament) {
    console.error(`[seed-tournament-fill] Турнир с id "${tournamentId}" не найден.`);
    await listOpenTournaments();
    process.exit(1);
  }

  if (tournament.status !== "registration") {
    console.error(
      `[seed-tournament-fill] Турнир "${tournament.name}" имеет статус "${tournament.status}" — ` +
        `записываться можно только в открытую регистрацию.`,
    );
    process.exit(1);
  }

  console.log(
    `[seed-tournament-fill] Турнир "${tournament.name}" — mode=${tournament.participantMode} ` +
      `level=${tournament.level} size=${tournament.size}`,
  );

  // Already-registered user ids in this tournament (both pair slots + singles).
  const pairs = await prisma.pair.findMany({
    where: { tournamentId: tournament.id },
    select: { player1Id: true, player2Id: true },
  });
  const singles = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: tournament.id },
    select: { userId: true },
  });
  const registeredIds = new Set<string>();
  for (const p of pairs) {
    registeredIds.add(p.player1Id);
    registeredIds.add(p.player2Id);
  }
  for (const s of singles) registeredIds.add(s.userId);

  // Eligible: matching level, not admin, not already registered. Shuffle for variety.
  const candidates = await prisma.user.findMany({
    where: {
      skillLevel: tournament.level,
      role: { not: "admin" },
      id: { notIn: registeredIds.size > 0 ? [...registeredIds] : undefined },
    },
    select: { id: true, nickname: true, skillLevel: true },
  });
  const eligible = shuffle(candidates);

  // Capacity: remaining slots = size − current count (pairs vs singles).
  const isPairs = tournament.participantMode === "pairs";
  const currentCount = isPairs ? pairs.length : singles.length;
  const remaining = tournament.size - currentCount;

  console.log(
    `[seed-tournament-fill] Занято ${currentCount}/${tournament.size}, свободно ${remaining}. ` +
      `Подходящих игроков: ${eligible.length}.`,
  );

  if (remaining <= 0) {
    console.log("[seed-tournament-fill] Турнир уже заполнен — нечего добавлять.");
    return;
  }

  let registered = 0;
  let idx = 0;

  if (isPairs) {
    // Take eligible 2-at-a-time; each pair = 2 distinct eligible users.
    while (registered < remaining && idx + 1 < eligible.length) {
      const a = eligible[idx];
      const b = eligible[idx + 1];
      idx += 2;
      try {
        await registerPair(prisma, {
          tournamentId: tournament.id,
          player1Id: a.id,
          player2Id: b.id,
        });
        registered++;
        console.log(
          `[seed-tournament-fill] + пара ${a.nickname} + ${b.nickname} (level=${a.skillLevel})`,
        );
      } catch (e) {
        if (e instanceof RegistrationError) {
          console.warn(
            `[seed-tournament-fill] пропуск ${a.nickname} + ${b.nickname}: ${e.code} — ${e.message}`,
          );
          continue;
        }
        throw e;
      }
    }
  } else {
    // Singles (round_robin/americano/mexicano): one-by-one.
    while (registered < remaining && idx < eligible.length) {
      const u = eligible[idx];
      idx += 1;
      try {
        await registerSingle(prisma, { tournamentId: tournament.id, userId: u.id });
        registered++;
        console.log(`[seed-tournament-fill] + ${u.nickname} (level=${u.skillLevel})`);
      } catch (e) {
        if (e instanceof RegistrationError) {
          console.warn(`[seed-tournament-fill] пропуск ${u.nickname}: ${e.code} — ${e.message}`);
          continue;
        }
        throw e;
      }
    }
  }

  const filled = currentCount + registered;
  const slotsLeft = tournament.size - filled;
  console.log(
    `[seed-tournament-fill] Готово. Зарегистрировано ${registered}, занято ${filled}/${tournament.size}, ` +
      `свободно ${slotsLeft}.`,
  );

  if (slotsLeft > 0) {
    console.log(
      `[seed-tournament-fill] Не хватает игроков уровня "${tournament.level}" — засей: ` +
        `TEST_USER_LEVEL=${tournament.level} npm run seed:test-users`,
    );
  }
}

main()
  .catch((err) => {
    console.error("[seed-tournament-fill] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
