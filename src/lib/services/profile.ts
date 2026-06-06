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
  // Only the three display-only domain fields mutate. userId comes from the
  // requireUser() guard, never from client input — a user edits only their own
  // row. phone/skillLevel may be undefined → cleared to null.
  return prisma.user.update({
    where: { id: userId },
    data: {
      courtSide: data.courtSide,
      phone: data.phone ?? null,
      skillLevel: data.skillLevel ?? null,
    },
    select: safeProfileSelect,
  });
}
