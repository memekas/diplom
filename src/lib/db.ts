import { PrismaClient } from "@prisma/client";

// Global singleton so Next.js dev hot-reload does not spawn a new PrismaClient
// (and a new SQLite connection) on every module reload. See STACK.md SQLite gotcha.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
