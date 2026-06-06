import { z } from "zod";

// Tournament sizes are the only allowed bracket sizes (single-elimination pairs).
// size is constrained to this set via zod; values outside it are rejected before
// any DB write (Pitfall 4 / threat T-02-03).
export const tournamentSizes = [4, 8, 16] as const;

// Status is stored as a String in the DB (SQLite) and validated by this TS-union
// + zod (CONTEXT D). Terminal status is "finished" (not "completed"). The status
// machine (tournament-status.ts) guards `from`/`to` against exactly these values.
export const tournamentStatuses = ["registration", "in_progress", "finished"] as const;

export type TournamentStatus = (typeof tournamentStatuses)[number];

export const tournamentStatusSchema = z.enum(tournamentStatuses);

// Create-tournament form schema (admin only). status is NOT here — it is hard-set
// to "registration" server-side in createTournament (never client-supplied).
// setsPerMatch/gamesPerSet are schema defaults, not form fields (CONTEXT).
export const createTournamentSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно"),
  // Coerce the form string to a number, then constrain membership to {4,8,16}.
  size: z.coerce
    .number()
    .refine((n): n is (typeof tournamentSizes)[number] => (tournamentSizes as readonly number[]).includes(n), {
      message: "Размер должен быть 4, 8 или 16",
    }),
  // Optional datetime: empty string → undefined; otherwise must parse to a valid Date.
  date: z
    .union([z.literal(""), z.coerce.date()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  // Optional location: trim, empty → undefined.
  location: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export type ParseTournamentFormResult =
  | { ok: true; data: CreateTournamentInput }
  | { ok: false; errors: Partial<Record<"name" | "size" | "date" | "location", string>> };

// Single source of truth for reading + validating the create form, mirroring
// parseProfileForm's discriminated shape (used by both client UX pre-validation
// and the server action security boundary so the two cannot drift).
export function parseTournamentForm(formData: FormData): ParseTournamentFormResult {
  const parsed = createTournamentSchema.safeParse({
    name: formData.get("name"),
    size: formData.get("size"),
    date: formData.get("date") ?? undefined,
    location: formData.get("location") ?? undefined,
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
