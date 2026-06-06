"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { createTournament } from "@/lib/services/tournament";
import { parseTournamentForm } from "@/lib/validation/tournament";

export type CreateTournamentActionState =
  | { ok: true }
  | { ok: false; errors: Partial<Record<"name" | "size" | "date" | "location" | "form", string>> }
  | null;

// Server Action = public HTTP endpoint. FIRST line is the security boundary:
// requireAdmin() derives the role from the signed session cookie (never from the
// form). A non-admin/anonymous direct POST throws "Forbidden" before any parse or
// DB work (AUTH-05, Pitfall 8) — the hidden nav link is cosmetic, this is real.
// The throw is intentionally NOT caught: the rejection IS the Forbidden throw to
// the caller; the page guard handles the UX redirect. Status is never read from
// the form — createTournament hard-sets "registration" (Plan 01, T-02-02).
export async function createTournamentAction(
  _prev: CreateTournamentActionState,
  formData: FormData,
): Promise<CreateTournamentActionState> {
  await requireAdmin();

  const parsed = parseTournamentForm(formData);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const created = await createTournament(prisma, parsed.data);
  // Refresh the public list so the new row is visible (Pitfall 10).
  revalidatePath("/tournaments");
  // redirect throws NEXT_REDIRECT — must be outside any try/catch.
  redirect(`/tournaments/${created.id}`);
}
