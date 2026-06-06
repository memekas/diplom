"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { registerPair, RegistrationError } from "@/lib/services/registration";
import { parseRegisterPairForm } from "@/lib/validation/registration";

export type ParticipateActionState = { ok: true } | { ok: false; error: string } | null;

// Server Action = public HTTP endpoint. FIRST line is the security boundary:
// requireUser() derives identity from the signed session cookie — a non-admin /
// anonymous direct POST throws "Unauthorized" before any parse or DB work
// (T-03-04, Pitfall 8). player1Id is ALWAYS the session user.id, NEVER read from
// the form (T-03-05); only player2Id is client-supplied. tournamentId is bound via
// .bind(null, tournamentId) from the leaf. No redirect — stay on the detail page so
// the new pair shows after revalidatePath (Pitfall 10).
export async function participateAction(
  tournamentId: string,
  _prev: ParticipateActionState,
  formData: FormData,
): Promise<ParticipateActionState> {
  const user = await requireUser();

  if (!tournamentId) {
    return { ok: false, error: "Турнир не найден" };
  }

  const parsed = parseRegisterPairForm(formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.errors.player2Id ?? "Выберите партнёра" };
  }

  try {
    await registerPair(prisma, {
      tournamentId,
      player1Id: user.id,
      player2Id: parsed.data.player2Id,
    });
  } catch (e) {
    if (e instanceof RegistrationError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Не удалось зарегистрироваться. Попробуйте ещё раз." };
  }

  // Purge the detail page cache so the new pair + counter render immediately.
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true };
}
