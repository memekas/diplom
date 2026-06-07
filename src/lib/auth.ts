import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  // Email + password only. Email verification stays OFF (Better Auth default) —
  // offline demo, no SMTP.
  emailAndPassword: {
    enabled: true,
  },
  // Domain fields collected at signup. `name` is required; `phone`/`skillLevel`
  // are optional. `courtSide` is intentionally NOT here — it is not collected at
  // signup and defaults to "either" on the User row (see schema).
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true },
      skillLevel: { type: "string", required: true, input: true },
      // Required unique handle (USER-01/USER-02). required:true → Better Auth
      // validates presence + adds it to the inferred signUp.email param type;
      // input:true → spread into createUser. DB @@unique aborts a dup atomically.
      nickname: { type: "string", required: true, input: true },
      // Optional date of birth collected at signup. A1-safe fallback (RESEARCH
      // Assumption A1): declared as "string" (NOT "date") — the form sends an ISO
      // string and the Prisma/SQLite adapter round-trips it into the DateTime?
      // birthDate column reliably, avoiding the "date"-type coercion risk.
      birthDate: { type: "string", required: false, input: true },
    },
    // Email change (USR-03). BOTH flags required (RESEARCH Pitfall 2): without
    // updateEmailWithoutVerification, changeEmail throws "Verification email
    // isn't enabled". Works here only because emailVerified defaults false and is
    // never set true (verification off, offline demo) → BA updates email + session
    // cookie immediately, no SMTP. NEVER change email via prisma.user.update.
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
  },
  plugins: [
    // adds `role` (+ banned/banReason/banExpires) to User. New signups get
    // "player"; the single admin is promoted by the seed script (plan 02).
    admin({ defaultRole: "player", adminRoles: ["admin"] }),
    nextCookies(), // MUST be the last plugin — sets cookies from Server Actions
  ],
});
