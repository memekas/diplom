import { z } from "zod";

// Pair-registration form schema (REG-01/REG-04). ONLY player2Nickname is
// client-supplied — player1 is the registering player's identity from the session
// (set by the action, never read from the form; T-03-01 / Pitfall 8). The partner
// text input posts the partner's nickname, resolved to a userId server-side. Only
// non-empty trim here — the partner's nick already passed register-time format checks.
export const registerPairSchema = z.object({
  player2Nickname: z.string().trim().min(1, "Введите ник партнёра"),
});

export type RegisterPairInput = z.infer<typeof registerPairSchema>;

export type ParseRegisterPairFormResult =
  | { ok: true; data: RegisterPairInput }
  | { ok: false; errors: Partial<Record<"player2Nickname", string>> };

// Single source of truth for reading + validating the register form, mirroring
// parseTournamentForm's discriminated shape (shared by client UX pre-validation
// and the server action security boundary so the two cannot drift).
export function parseRegisterPairForm(formData: FormData): ParseRegisterPairFormResult {
  const parsed = registerPairSchema.safeParse({
    player2Nickname: formData.get("player2Nickname"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }

  return { ok: true, data: parsed.data };
}

// Single-registration form schema (REG-06). Singles needs NO partner fields — the
// registering player's identity comes from the session guard in the action (never
// from the form; T-03-01 / Pitfall 8), so the schema carries no client-supplied
// fields. Kept as an explicit (empty) schema + discriminated parse result for
// uniformity with parseRegisterPairForm so the two cannot drift.
export const registerSingleSchema = z.object({});

export type RegisterSingleInput = z.infer<typeof registerSingleSchema>;

export type ParseRegisterSingleFormResult =
  | { ok: true; data: RegisterSingleInput }
  | { ok: false; errors: Record<string, string> };

export function parseRegisterSingleForm(_formData: FormData): ParseRegisterSingleFormResult {
  const parsed = registerSingleSchema.safeParse({});
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }
  return { ok: true, data: parsed.data };
}
