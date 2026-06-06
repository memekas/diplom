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
      skillLevel: { type: "string", required: false, input: true },
    },
  },
  plugins: [
    // adds `role` (+ banned/banReason/banExpires) to User. New signups get
    // "player"; the single admin is promoted by the seed script (plan 02).
    admin({ defaultRole: "player", adminRoles: ["admin"] }),
    nextCookies(), // MUST be the last plugin — sets cookies from Server Actions
  ],
});
