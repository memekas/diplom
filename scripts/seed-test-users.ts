// Seed test players for local development / demo.
//
// Creates N test players via Better Auth (so passwords are scrypt-hashed and the
// Account rows match Better Auth's expectations, exactly like prisma/seed.ts), with
// varied courtSide / skillLevel / phone so the partner picker and participant lists
// have realistic data. Idempotent: a player whose email already exists is skipped.
//
// Usage:
//   npx tsx scripts/seed-test-users.ts            # random 4..16 players, random levels
//   npx tsx scripts/seed-test-users.ts 8          # custom count (positive integer)
//   TEST_USER_COUNT=8 npx tsx scripts/seed-test-users.ts        # count via env
//   TEST_USER_LEVEL=advanced npx tsx scripts/seed-test-users.ts # fix level for ALL players
//   TEST_USER_PASSWORD=Secret123! npx tsx scripts/seed-test-users.ts
//
// Count: from argv[2] OR TEST_USER_COUNT; if neither set → random integer 4..16.
// Level: TEST_USER_LEVEL (beginner|progressing|intermediate|advanced|pro) applies to
//        EVERY player; if unset → each player gets a random level.
// All players share one password (default "12345678") for easy manual login.
// Emails are player1@padel.local … playerN@padel.local.
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/db";

const PASSWORD = process.env.TEST_USER_PASSWORD || "12345678";
const EMAIL_DOMAIN = "padel.local";

// Round-robin pools so the data is varied but deterministic.
const FIRST_NAMES = [
  "Иван", "Мария", "Алексей", "Ольга", "Дмитрий", "Анна", "Сергей", "Елена",
  "Павел", "Наталья", "Андрей", "Ирина", "Никита", "Татьяна", "Роман", "Юлия",
  "Максим", "Екатерина", "Артём", "Светлана",
];
const LAST_NAMES = [
  "Петров", "Сидорова", "Иванов", "Кузнецова", "Смирнов", "Попова", "Волков",
  "Морозова", "Новиков", "Васильева", "Фёдоров", "Соколова", "Зайцев", "Орлова",
  "Лебедев", "Козлова", "Егоров", "Павлова", "Макаров", "Никитина",
];
const COURT_SIDES = ["left", "right", "either"] as const;
const SKILL_LEVELS = ["beginner", "progressing", "intermediate", "advanced", "pro"] as const;

async function main() {
  // Fixed skill level for all players (TEST_USER_LEVEL), validated; else random per player.
  const levelEnv = process.env.TEST_USER_LEVEL;
  if (levelEnv && !SKILL_LEVELS.includes(levelEnv as (typeof SKILL_LEVELS)[number])) {
    console.error(
      `[seed-test-users] Invalid TEST_USER_LEVEL "${levelEnv}" — expected one of: ${SKILL_LEVELS.join(", ")}`,
    );
    process.exit(1);
  }
  const fixedLevel = levelEnv as (typeof SKILL_LEVELS)[number] | undefined;
  const randomLevel = () => SKILL_LEVELS[Math.floor(Math.random() * SKILL_LEVELS.length)];

  // Count: argv[2] OR TEST_USER_COUNT; if neither → random 4..16 inclusive.
  const countRaw = process.argv[2] ?? process.env.TEST_USER_COUNT;
  let count: number;
  if (countRaw === undefined || countRaw === "") {
    count = 4 + Math.floor(Math.random() * 13); // 4..16
  } else {
    count = Number(countRaw);
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      throw new Error(`Invalid count "${countRaw}" — expected an integer 1..500`);
    }
  }

  let created = 0;
  let skipped = 0;

  for (let i = 1; i <= count; i++) {
    const email = `player${i}@${EMAIL_DOMAIN}`;
    // Deterministic unique nickname per test user (USER-01), matching the playerN
    // email scheme. Format-valid for registerSchema (3–30, [A-Za-z0-9_-]).
    const nickname = `player${i}`;
    const name = `${FIRST_NAMES[(i - 1) % FIRST_NAMES.length]} ${LAST_NAMES[(i - 1) % LAST_NAMES.length]}`;
    const courtSide = COURT_SIDES[(i - 1) % COURT_SIDES.length];
    const skillLevel = fixedLevel ?? randomLevel();
    // Give ~every other player a phone, to exercise the optional field both ways.
    const phone = i % 2 === 0 ? `+7 900 ${String(100 + i).padStart(3, "0")}-00-00` : undefined;
    // Deterministic optional birthDate (exercises the new optional User.birthDate field).
    const birthDate = new Date(Date.UTC(1990 + (i % 20), (i - 1) % 12, ((i - 1) % 28) + 1));

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      skipped++;
      continue;
    }

    // signUpEmail accepts the additionalFields declared input:true in lib/auth.ts
    // (phone, skillLevel). courtSide is NOT a signup field — set it via update after.
    // The email check above does NOT cover the nickname @@unique constraint, so a
    // pre-existing nickname under a different email would throw FAILED_TO_CREATE_USER.
    // Log-and-skip instead of aborting the whole loop (WR-01).
    try {
      await auth.api.signUpEmail({
        body: { email, password: PASSWORD, name, nickname, phone, skillLevel },
      });
      await prisma.user.update({ where: { email }, data: { courtSide, birthDate } });
      created++;
      console.log(`[seed-test-users] + ${email}  "${name}"  side=${courtSide} level=${skillLevel}`);
    } catch (e) {
      console.warn(`[seed-test-users] skip ${email}: ${(e as Error).message}`);
      skipped++;
      continue;
    }
  }

  console.log(
    `[seed-test-users] Done. Created ${created}, skipped ${skipped} (already existed). ` +
      `Count=${count}, level=${fixedLevel ?? "random"}. ` +
      `Login: player1..player${count}@${EMAIL_DOMAIN} / password "${PASSWORD}".`,
  );
}

main()
  .catch((err) => {
    console.error("[seed-test-users] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
