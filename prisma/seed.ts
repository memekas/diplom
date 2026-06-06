// Idempotent admin seed. Creates exactly one organization admin from env vars
// (ADMIN_EMAIL / ADMIN_PASSWORD) via Better Auth so the password is hashed
// (scrypt) and the Account row matches Better Auth's expectations, then promotes
// the role to "admin". Guarded by an existence check — re-running is a no-op
// (PITFALLS Pitfall 12: env creds, never committed; idempotent).
//
// Run via the prisma.config.ts seed hook: `npx prisma db seed` (tsx prisma/seed.ts).
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment to seed the admin.",
    );
  }

  // Idempotency keyed on email only; the nickname @@unique constraint ("admin") is
  // NOT covered by this guard. Safe under the locked `migrate reset` + reseed flow
  // (empty table → no collisions). If re-seeded against a non-empty DB where "admin"
  // exists under a different email, signUpEmail below would throw (WR-01).
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(
      `[seed] Admin already exists (${email}, role=${existing.role}) — skipping.`,
    );
    return;
  }

  await auth.api.signUpEmail({
    body: { email, password, name: "Org Admin", nickname: "admin" },
  });
  await prisma.user.update({ where: { email }, data: { role: "admin" } });

  console.log(`[seed] Created admin ${email} with role "admin".`);
}

main()
  .catch((err) => {
    console.error("[seed] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
