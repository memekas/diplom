import type { PrismaClient } from "@prisma/client";
import type { ProfileInput } from "@/lib/validation/profile";

// Profile domain logic over the Prisma User. Per ARCHITECTURE the service takes
// the prisma client in (actions stay thin). Every read/write uses an explicit
// `select` of safe fields only — never password/credential columns (Pitfall 12;
// the password credential lives in the Account table, not on User).
const safeProfileSelect = {
  id: true,
  name: true,
  email: true,
  courtSide: true,
  phone: true,
  skillLevel: true,
  nickname: true,
  birthDate: true,
} as const;

export async function getProfile(prisma: PrismaClient, userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: safeProfileSelect,
  });
}

export async function updateProfile(
  prisma: PrismaClient,
  userId: string,
  data: ProfileInput,
) {
  // Domain fields mutate via direct prisma.update (A5). userId comes from the
  // requireUser() guard, never from client input — a user edits only their own
  // row. phone/birthDate may be undefined → cleared to null. skillLevel is NOT
  // NULL (Phase 7): leave it unchanged when no selection is submitted. EMAIL is
  // NOT written here (Pitfall 3) — Better Auth owns it; the action routes email
  // through auth.api.changeEmail. nickname is written directly; the @@unique
  // conflict (P2002) is NOT pre-checked here (Pitfall 4) — it propagates to the
  // action, which maps it to a RU message (no TOCTOU pre-check).
  return prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      courtSide: data.courtSide,
      phone: data.phone ?? null,
      birthDate: data.birthDate ?? null,
      nickname: data.nickname,
      ...(data.skillLevel !== undefined ? { skillLevel: data.skillLevel } : {}),
    },
    select: safeProfileSelect,
  });
}
