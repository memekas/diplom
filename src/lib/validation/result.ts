import { z } from "zod";

// Per-set result form schema (MATCH-01). The score-form posts a free-form number of set rows,
// each row a pair of integer game counts named `set{n}_a` / `set{n}_b` (n starting at 1).
// A row is "present" when EITHER input is non-empty; a fully-empty row is skipped (a match
// may end in 2 of 3 sets — trailing empty rows are ignored, per CONTEXT Claude's Discretion).
// This parser ONLY shapes + integer-coerces input; set/match VALIDITY (win-by-2, majority)
// is recordResult/setWinner's job server-side (T-05-06) — not re-implemented here.

const gameCountSchema = z.coerce
  .number({ message: "Счёт должен быть числом" })
  .int("Счёт должен быть целым числом")
  .min(0, "Счёт не может быть отрицательным");

export type RecordResultInput = {
  sets: { gamesPair1: number; gamesPair2: number }[];
};

export type ParseRecordResultFormResult =
  | { ok: true; data: RecordResultInput }
  | { ok: false; errors: { sets?: string } };

// Scan set{n}_a / set{n}_b pairs DYNAMICALLY (n = 1, 2, … until a row is entirely absent).
// No upper cap — any number of sets is accepted. Empty rows (both blank) are skipped; a
// partially-filled row (one side blank) is an error.
export function parseRecordResultForm(formData: FormData): ParseRecordResultFormResult {
  const sets: { gamesPair1: number; gamesPair2: number }[] = [];

  for (let n = 1; ; n++) {
    const rawA = formData.get(`set${n}_a`);
    const rawB = formData.get(`set${n}_b`);
    // Row absent entirely (neither key present) → stop scanning.
    if (rawA === null && rawB === null) break;
    const aStr = typeof rawA === "string" ? rawA.trim() : "";
    const bStr = typeof rawB === "string" ? rawB.trim() : "";

    // Fully-empty row → skip (trailing/unused set).
    if (aStr === "" && bStr === "") continue;

    // Partially-filled row → invalid input.
    if (aStr === "" || bStr === "") {
      return { ok: false, errors: { sets: `Заполните оба счёта в сете ${n}` } };
    }

    const parsedA = gameCountSchema.safeParse(aStr);
    const parsedB = gameCountSchema.safeParse(bStr);
    if (!parsedA.success) {
      return { ok: false, errors: { sets: `Сет ${n}: ${parsedA.error.issues[0]?.message ?? "недопустимый счёт"}` } };
    }
    if (!parsedB.success) {
      return { ok: false, errors: { sets: `Сет ${n}: ${parsedB.error.issues[0]?.message ?? "недопустимый счёт"}` } };
    }

    sets.push({ gamesPair1: parsedA.data, gamesPair2: parsedB.data });
  }

  if (sets.length === 0) {
    return { ok: false, errors: { sets: "Введите счёт хотя бы одного сета" } };
  }

  return { ok: true, data: { sets } };
}
