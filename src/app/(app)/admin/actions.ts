"use server";

import { requireAdmin } from "@/lib/auth-guards";

// Proof action for AUTH-05: a Server Action is a public HTTP endpoint. Its FIRST
// line is the server-side guard, so a non-admin/anonymous direct invocation is
// rejected ("Forbidden") regardless of whether any UI button is shown.
// Later phases replace adminPing with real admin mutations (create tournament,
// generate bracket, record result) — each opening with requireAdmin().
export async function adminPing() {
  const user = await requireAdmin();
  return { ok: true as const, admin: user.email };
}
