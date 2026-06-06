import { z } from "zod";

// Pair-registration form schema (REG-01). ONLY player2Id is client-supplied —
// player1 is the registering player's identity from the session (set by the action
// in Plan 02, never read from the form; T-03-01 / Pitfall 8). The partner <select>
// posts the chosen user's id as player2Id.
export const registerPairSchema = z.object({
  player2Id: z.string().trim().min(1, "Выберите партнёра"),
});

export type RegisterPairInput = z.infer<typeof registerPairSchema>;

export type ParseRegisterPairFormResult =
  | { ok: true; data: RegisterPairInput }
  | { ok: false; errors: Partial<Record<"player2Id", string>> };

// Single source of truth for reading + validating the register form, mirroring
// parseTournamentForm's discriminated shape (shared by client UX pre-validation
// and the server action security boundary so the two cannot drift).
export function parseRegisterPairForm(formData: FormData): ParseRegisterPairFormResult {
  const parsed = registerPairSchema.safeParse({
    player2Id: formData.get("player2Id"),
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
