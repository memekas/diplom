import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Server-side authorization boundary. (next/headers makes this server-only by
// construction; no client import path reaches it.) These guard Server Actions and protected
// Server Components — they are the REAL security check, not UI hiding (PITFALLS
// Pitfall 8). Identity is derived solely from the signed Better Auth session
// cookie via auth.api.getSession; never from client-supplied props/form data.
// All of this runs in the Node runtime (no Edge/crypto concerns).

/**
 * Require an authenticated user. Throws "Unauthorized" when anonymous.
 * Callers in Server Components may catch this and redirect("/login"); the
 * guard's contract is simply to reject. Returns the authenticated user.
 */
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

/**
 * Require an admin user. Throws "Forbidden" when anonymous or when the session
 * role is not "admin". The role is read from the session (server-side), never
 * trusted from client input. Returns the admin user.
 */
export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Forbidden");
  }
  return session.user;
}
