"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { BracketError, generateBracket } from "@/lib/services/bracket";
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

export type StartTournamentActionState = { ok: true } | { ok: false; error: string } | null;

// Admin-only «Старт» entry (BRKT-01). FIRST line requireAdmin() is the security
// boundary (T-04-04 / Pitfall 8 / AUTH-05): a non-admin or anonymous direct POST
// throws "Forbidden" before any DB work — that throw is intentionally NOT caught.
// tournamentId is bound from the leaf, never trusted from the client. generateBracket
// re-reads status/pair-count/existing-match guards inside its own transaction, so the
// disabled button is cosmetic; the data-layer guards are authoritative. Its plain
// Error (RU message) on reject — wrong-status / wrong-count / already-generated
// (BRKT-03) — is mapped to the user here. revalidatePath purges the cache so the
// bracket renders immediately (Pitfall 10). No redirect — stay on the page.
export async function startTournamentAction(
  tournamentId: string,
  _prev: StartTournamentActionState,
  _formData: FormData,
): Promise<StartTournamentActionState> {
  await requireAdmin();

  if (!tournamentId) {
    return { ok: false, error: "Турнир не найден" };
  }

  try {
    await generateBracket(prisma, tournamentId);
  } catch (e) {
    // Only surface our own typed reject messages; never forward raw Prisma/internal
    // error text to the client (WR-02).
    if (e instanceof BracketError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Не удалось сгенерировать сетку. Попробуйте ещё раз." };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true };
}
