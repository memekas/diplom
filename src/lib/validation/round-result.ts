import { z } from "zod";
import type { RecordRoundResultInput } from "@/lib/services/round-result";

// Form parser for the round-based result form (FMT-03 / SCORE-01). It branches on the
// tournament's scoringMode:
//   points → two integer fields `points_a` / `points_b` (non-negative);
//   sets   → up to `setsPerMatch` rows `set{n}_a` / `set{n}_b` (mirror of
//            parseRecordResultForm — empty rows skipped, partial rows are errors).
// Like parseRecordResultForm this ONLY shapes + integer-coerces input; score VALIDITY
// (win-by-2, draw rules, sets-won) is recordRoundResult / scorePointsMode / scoreSetsMode's
// job server-side (T-09-18) — not re-implemented here.

const countSchema = z.coerce
  .number({ message: "Счёт должен быть числом" })
  .int("Счёт должен быть целым числом")
  .min(0, "Счёт не может быть отрицательным");

export type ParseRoundResultFormResult =
  | { ok: true; data: RecordRoundResultInput }
  | { ok: false; errors: { score?: string } };

export function parseRoundResultForm(
  formData: FormData,
  opts: { scoringMode: string },
): ParseRoundResultFormResult {
  if (opts.scoringMode === "points") {
    const rawA = formData.get("points_a");
    const rawB = formData.get("points_b");
    const aStr = typeof rawA === "string" ? rawA.trim() : "";
    const bStr = typeof rawB === "string" ? rawB.trim() : "";
    if (aStr === "" || bStr === "") {
      return { ok: false, errors: { score: "Введите счёт обеих команд" } };
    }
    const parsedA = countSchema.safeParse(aStr);
    const parsedB = countSchema.safeParse(bStr);
    if (!parsedA.success) {
      return { ok: false, errors: { score: parsedA.error.issues[0]?.message ?? "недопустимый счёт" } };
    }
    if (!parsedB.success) {
      return { ok: false, errors: { score: parsedB.error.issues[0]?.message ?? "недопустимый счёт" } };
    }
    return { ok: true, data: { pointsA: parsedA.data, pointsB: parsedB.data } };
  }

  // sets mode — mirror parseRecordResultForm (dynamic scan, no upper cap).
  const sets: { gamesPair1: number; gamesPair2: number }[] = [];
  for (let n = 1; ; n++) {
    const rawA = formData.get(`set${n}_a`);
    const rawB = formData.get(`set${n}_b`);
    if (rawA === null && rawB === null) break; // no more rows
    const aStr = typeof rawA === "string" ? rawA.trim() : "";
    const bStr = typeof rawB === "string" ? rawB.trim() : "";

    if (aStr === "" && bStr === "") continue; // skip empty/trailing row
    if (aStr === "" || bStr === "") {
      return { ok: false, errors: { score: `Заполните оба счёта в сете ${n}` } };
    }

    const parsedA = countSchema.safeParse(aStr);
    const parsedB = countSchema.safeParse(bStr);
    if (!parsedA.success) {
      return { ok: false, errors: { score: `Сет ${n}: ${parsedA.error.issues[0]?.message ?? "недопустимый счёт"}` } };
    }
    if (!parsedB.success) {
      return { ok: false, errors: { score: `Сет ${n}: ${parsedB.error.issues[0]?.message ?? "недопустимый счёт"}` } };
    }
    sets.push({ gamesPair1: parsedA.data, gamesPair2: parsedB.data });
  }

  if (sets.length === 0) {
    return { ok: false, errors: { score: "Введите счёт хотя бы одного сета" } };
  }
  return { ok: true, data: { sets } };
}
