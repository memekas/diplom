"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import {
  AdminError,
  finishTournament,
  removeParticipant,
  removePair,
} from "@/lib/services/admin";
import { BracketError, generateBracket } from "@/lib/services/bracket";
import {
  findUserIdByNickname,
  registerPair,
  registerSingle,
  RegistrationError,
} from "@/lib/services/registration";
import { recordResult, ResultError } from "@/lib/services/result";
import { parseRegisterPairForm } from "@/lib/validation/registration";
import { parseRecordResultForm } from "@/lib/validation/result";

export type ParticipateActionState = { ok: true } | { ok: false; error: string } | null;

// Server Action = public HTTP endpoint. FIRST line is the security boundary:
// requireUser() derives identity from the signed session cookie — a non-admin /
// anonymous direct POST throws "Unauthorized" before any parse or DB work
// (T-03-04, Pitfall 8). player1Id is ALWAYS the session user.id, NEVER read from
// the form (T-03-05); only the partner's nickname is client-supplied (resolved to
// player2Id server-side via findUserIdByNickname — REG-04). tournamentId is bound via
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
    return { ok: false, error: parsed.errors.player2Nickname ?? "Введите ник партнёра" };
  }

  try {
    // Resolve the partner nickname → userId BEFORE the transactional gate (REG-04).
    // findUserIdByNickname throws RegistrationError("partner_not_found") on an unknown
    // nick — caught by the branch below. registerPair stays untouched (REG-01/02/03).
    const player2Id = await findUserIdByNickname(prisma, parsed.data.player2Nickname);
    await registerPair(prisma, {
      tournamentId,
      player1Id: user.id,
      player2Id,
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

// Single-player registration (REG-06) — mirror of participateAction on the singles
// path. FIRST line requireUser() is the security boundary (T-08-11 / Pitfall 8):
// identity comes from the signed session, NEVER from the form — the singles form
// carries no client-supplied fields (registerSingleSchema is empty), so userId is
// the only input and it is always user.id. tournamentId is bound from the leaf via
// .bind(null, tournamentId), never trusted from the body. registerSingle re-reads
// status / mode / level / capacity / duplicate guards inside its own transaction, so
// the data layer is authoritative regardless of the UI. Only typed RegistrationError
// RU messages are surfaced (level_mismatch / wrong_mode / not_open / tournament_full /
// already_registered); any other throw maps to a generic RU fallback — no raw Prisma
// text reaches the client (T-08-07). revalidatePath purges the detail-page cache so
// the new participant + counter render immediately (Pitfall 10). No redirect.
export async function participateSingleAction(
  tournamentId: string,
  _prev: ParticipateActionState,
  _formData: FormData,
): Promise<ParticipateActionState> {
  const user = await requireUser();

  if (!tournamentId) {
    return { ok: false, error: "Турнир не найден" };
  }

  try {
    await registerSingle(prisma, { tournamentId, userId: user.id });
  } catch (e) {
    if (e instanceof RegistrationError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Не удалось зарегистрироваться. Попробуйте ещё раз." };
  }

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

export type RemoveRegistrationActionState = { ok: true } | { ok: false; error: string } | null;

// Admin-only registration removal (ADMN-01). Single kind-dispatched action per
// RESEARCH Open Q2: kind discriminates pair vs single. FIRST line requireAdmin() is
// the security boundary (T-08-15 / Pitfall 8): a non-admin or anonymous direct POST
// throws "Forbidden" before any DB work — that throw is intentionally NOT caught.
// tournamentId, kind, AND id are all bound from the leaf via .bind(), never trusted
// from the form body (T-08-08/16) so a tampered form cannot redirect the delete.
// removePair/removeParticipant re-read the registration-open status guard inside their
// own transaction, so deletion after start is rejected at the data layer regardless of
// the UI (T-08-18). Only typed AdminError RU messages are surfaced; any other throw maps
// to a generic RU fallback — no raw Prisma text reaches the client (T-08-07). No redirect.
export async function removeRegistrationAction(
  tournamentId: string,
  kind: "pair" | "player",
  id: string,
  _prev: RemoveRegistrationActionState,
  _formData: FormData,
): Promise<RemoveRegistrationActionState> {
  await requireAdmin();

  if (!tournamentId || !id) {
    return { ok: false, error: "Регистрация не найдена" };
  }

  try {
    if (kind === "pair") {
      await removePair(prisma, { tournamentId, pairId: id });
    } else {
      await removeParticipant(prisma, { tournamentId, playerId: id });
    }
  } catch (e) {
    if (e instanceof AdminError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Не удалось удалить регистрацию." };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true };
}

export type FinishTournamentActionState = { ok: true } | { ok: false; error: string } | null;

// Admin-only manual finish (ADMN-02). FIRST line requireAdmin() is the security
// boundary (T-08-15 / Pitfall 8): a non-admin or anonymous direct POST throws
// "Forbidden" before any DB work — that throw is intentionally NOT caught. tournamentId
// is bound from the leaf, never trusted from the client. finishTournament is idempotent
// (Pitfall 8 / T-08-10): a repeat finish on an already-finished tournament is a no-op,
// so a duplicate POST cannot throw. The underlying status machine rejects illegal
// transitions with a plain Error — mapped to a generic RU fallback here so no raw text
// reaches the client (T-08-07). revalidatePath purges the cache so the finished state
// renders immediately (Pitfall 10). No redirect.
export async function finishTournamentAction(
  tournamentId: string,
  _prev: FinishTournamentActionState,
  _formData: FormData,
): Promise<FinishTournamentActionState> {
  await requireAdmin();

  if (!tournamentId) {
    return { ok: false, error: "Турнир не найден" };
  }

  try {
    await finishTournament(prisma, tournamentId);
  } catch (e) {
    // Surface typed AdminError RU messages (e.g. finish-from-registration =
    // "not_started", a permanent state error) instead of the generic transient
    // retry — no raw transition-machine text reaches the client (WR-03 / T-08-07).
    if (e instanceof AdminError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Не удалось завершить турнир. Попробуйте ещё раз." };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true };
}

export type RecordResultActionState = { ok: true } | { ok: false; error: string } | null;

// Admin-only per-set result entry/edit (MATCH-01/02/03/04). FIRST line requireAdmin()
// is the security boundary (T-05-04 / Pitfall 8 / AUTH-05): a non-admin or anonymous
// direct POST throws "Forbidden" before any parse or DB work — that throw is intentionally
// NOT caught. BOTH tournamentId AND matchId are bound from the leaf, never trusted from the
// form body (T-05-05) so a tampered form cannot redirect the write to another match. The
// untrusted per-set games are integer-coerced by parseRecordResultForm; recordResult/setWinner
// reject any invalid set server-side (T-05-06). Only typed ResultError RU messages are
// surfaced; any other throw maps to a generic RU fallback — no raw Prisma text reaches the
// client (T-05-07 / WR-02). revalidatePath purges the cache so the bracket + champion update
// immediately, even on a prod build (Pitfall 10). No redirect — stay on the page.
export async function recordResultAction(
  tournamentId: string,
  matchId: string,
  setsPerMatch: number,
  _prev: RecordResultActionState,
  formData: FormData,
): Promise<RecordResultActionState> {
  await requireAdmin();

  if (!tournamentId || !matchId) {
    return { ok: false, error: "Матч не найден" };
  }

  const parsed = parseRecordResultForm(formData, setsPerMatch);
  if (!parsed.ok) {
    return { ok: false, error: parsed.errors.sets ?? "Проверьте введённый счёт" };
  }

  try {
    await recordResult(prisma, matchId, parsed.data.sets);
  } catch (e) {
    if (e instanceof ResultError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Не удалось сохранить счёт. Попробуйте ещё раз." };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true };
}
