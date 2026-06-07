// Integration check (WR-01, Phase 11): the register form sends birthDate as a full
// ISO-datetime string (birthDate.toISOString()) into the Better Auth `string`-typed
// additionalField, which writes through the Prisma/SQLite adapter into the
// User.birthDate DateTime? column. This asserts that round-trip actually persists a
// non-null Date (RESEARCH Assumption A1 — coercion must be confirmed, not assumed).
//
// Hits the REAL auth.api.signUpEmail path + real DB (DATABASE_URL), then cleans up the
// throwaway user. Exits non-zero on failure.
//
// Run: npx tsx scripts/check-signup-birthdate.ts
import assert from "node:assert/strict";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/db";

async function main() {
  const stamp = Date.now();
  const email = `birthdate-check-${stamp}@padel.local`;
  const nickname = `bd_check_${stamp}`;
  // Exactly what register-form.tsx sends: a Date → .toISOString() (full datetime).
  const iso = new Date("2000-05-01").toISOString();

  let createdId: string | null = null;
  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password: "Test1234!",
        name: "BirthDate Check",
        nickname,
        skillLevel: "intermediate",
        birthDate: iso,
      },
    });

    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true, birthDate: true },
    });
    createdId = u?.id ?? null;

    assert.ok(u, "user row was created");
    assert.ok(u.birthDate instanceof Date, "birthDate persisted as a Date (not null / not string)");
    assert.equal(
      u.birthDate.toISOString(),
      iso,
      "birthDate round-trips to the exact value sent at signup",
    );
    console.log(`  ok - signup persists birthDate as Date (${u.birthDate.toISOString()})`);
    console.log("PASS: birthDate signup persistence verified.");
  } finally {
    if (createdId) await prisma.user.delete({ where: { id: createdId } });
  }
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
