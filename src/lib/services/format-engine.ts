import type { PrismaClient } from "@prisma/client";
import { generateBracket } from "./bracket";
import { generateRoundRobin } from "./round-robin";
import { generateAmericano } from "./americano";
import { generateMexicanoRound1 } from "./mexicano";
import { recordResult } from "./result";
import { recordRoundResult } from "./round-result";
import { parseRecordResultForm } from "@/lib/validation/result";
import { parseRoundResultForm } from "@/lib/validation/round-result";

// --- FMT-01/02/03 + SCORE-01 dispatch (Plan 06) ---
// The single fan-out point that routes both START and RECORD-RESULT by the tournament's
// DB-authoritative `format`. It owns ONLY routing + parser selection — it never
// re-implements generator/recorder logic (that lives in bracket/round-robin/americano/
// mexicano/result/round-result). The playoff branch threads through the SAME parser
// (parseRecordResultForm) and recorder (recordResult) as before, so playoff behaviour is
// byte-for-byte unchanged; only the call site moved here.
//
// format is re-read from the DB inside each function — the client's claimed format is
// never trusted (T-09-23): a tampered form cannot misroute the generator/recorder.

// startFormat: route the "Старт" by tournament.format.
//   playoff      → generateBracket   (UNCHANGED playoff path)
//   round_robin  → generateRoundRobin
//   americano    → generateAmericano
//   mexicano     → generateMexicanoRound1
// generateBracket throws BracketError; the three round-based generators throw FormatError
// — the caller (action) maps both. An unknown format throws a plain Error (defensive;
// the schema enum keeps this unreachable in practice).
export async function startFormat(prisma: PrismaClient, tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { format: true },
  });

  switch (tournament.format) {
    case "playoff":
      return generateBracket(prisma, tournamentId);
    case "round_robin":
      return generateRoundRobin(prisma, tournamentId);
    case "americano":
      return generateAmericano(prisma, tournamentId);
    case "mexicano":
      return generateMexicanoRound1(prisma, tournamentId);
    default:
      throw new Error(`Неизвестный формат турнира: "${tournament.format}"`);
  }
}

// Single discriminated return contract so the action maps form-parse errors and service
// rejects uniformly. Service rejects (BracketError/FormatError/ResultError/
// RoundResultError) are still THROWN — recordFormatResult only converts parser failures
// into { ok: false }; the throw path is handled by the action's try/catch.
export type RecordFormatResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

// recordFormatResult: route result entry by tournament.format.
//   playoff      → parseRecordResultForm(setsPerMatch) → recordResult (UNCHANGED path)
//   round-based  → parseRoundResultForm({scoringMode, setsPerMatch}) → recordRoundResult
// setsPerMatch/scoringMode are read from the DB (authoritative) — the action's
// setsPerMatch parameter is kept for UI compatibility but NOT trusted here.
export async function recordFormatResult(
  prisma: PrismaClient,
  tournamentId: string,
  matchId: string,
  formData: FormData,
): Promise<RecordFormatResult> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { format: true, scoringMode: true, setsPerMatch: true },
  });

  if (tournament.format === "playoff") {
    // UNCHANGED playoff path: same parser + same recorder as the original action.
    const parsed = parseRecordResultForm(formData, tournament.setsPerMatch);
    if (!parsed.ok) {
      return { ok: false, error: parsed.errors.sets ?? "Проверьте введённый счёт" };
    }
    const result = await recordResult(prisma, matchId, parsed.data.sets);
    return { ok: true, result };
  }

  // round-based (round_robin / americano / mexicano): matchId is a RoundMatch id.
  const parsed = parseRoundResultForm(formData, {
    scoringMode: tournament.scoringMode,
    setsPerMatch: tournament.setsPerMatch,
  });
  if (!parsed.ok) {
    return { ok: false, error: parsed.errors.score ?? "Проверьте введённый счёт" };
  }
  const result = await recordRoundResult(prisma, matchId, parsed.data);
  return { ok: true, result };
}
