import { z } from "zod";
import { skillLevels } from "@/lib/validation/auth";

// Legacy bracket sizes (playoff single-elimination). Kept exported for the status
// machine + tests; format-specific size rules now live in createTournamentSchema's
// superRefine. PLAYOFF_SIZES mirrors this for the new format-aware path.
export const tournamentSizes = [4, 8, 16] as const;

// Status is stored as a String in the DB (SQLite) and validated by this TS-union
// + zod (CONTEXT D). Terminal status is "finished" (not "completed"). The status
// machine (tournament-status.ts) guards `from`/`to` against exactly these values.
export const tournamentStatuses = ["registration", "in_progress", "finished"] as const;

export type TournamentStatus = (typeof tournamentStatuses)[number];

export const tournamentStatusSchema = z.enum(tournamentStatuses);

// --- Multiformat tuples (TOUR-05). DB stores these as String; zod enums validate. ---
export const tournamentFormats = ["playoff", "round_robin", "americano", "mexicano"] as const;
export const participantModes = ["pairs", "singles"] as const;
export const scoringModes = ["sets", "points"] as const;
export const PLAYOFF_SIZES = [4, 8, 16] as const;
export const SIZE_CAP = 24; // soft cap (D7): N(N-1)/2 matches stays manageable

// Create-tournament form schema (admin only). status is NOT here — it is hard-set
// to "registration" server-side in createTournament (never client-supplied).
// Size/mode rules are format-dependent (superRefine) — no Prisma enums (CONTEXT).
export const createTournamentSchema = z
  .object({
    name: z.string().trim().min(1, "Название обязательно"),
    format: z.enum(tournamentFormats),
    participantMode: z.enum(participantModes),
    level: z.enum(skillLevels),
    size: z.coerce.number().int().positive(),
    price: z.coerce.number().int().min(0).optional(),
    scoringMode: z.enum(scoringModes),
    targetPoints: z.coerce.number().int().positive().optional(), // points-mode; server defaults 24
    totalRounds: z.coerce.number().int().positive().optional(), // americano/mexicano round count
    setsPerMatch: z.coerce.number().int().min(1).optional(), // sets-mode, NO upper cap (D5)
    gamesPerSet: z.coerce.number().int().min(1).optional(),
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
  })
  .superRefine((d, ctx) => {
    // Format-dependent size rules (D1 / FORMATS.md §6).
    if (d.format === "playoff") {
      if (!(PLAYOFF_SIZES as readonly number[]).includes(d.size))
        ctx.addIssue({ code: "custom", path: ["size"], message: "Размер должен быть 4, 8 или 16" });
    } else if (d.format === "round_robin") {
      if (d.size < 3) ctx.addIssue({ code: "custom", path: ["size"], message: "Минимум 3 участника" });
      if (d.size > SIZE_CAP) ctx.addIssue({ code: "custom", path: ["size"], message: `Максимум ${SIZE_CAP}` });
    } else if (d.format === "americano") {
      if (d.size < 4) ctx.addIssue({ code: "custom", path: ["size"], message: "Минимум 4 игрока" });
      if (d.size > SIZE_CAP) ctx.addIssue({ code: "custom", path: ["size"], message: `Максимум ${SIZE_CAP}` });
    } else if (d.format === "mexicano") {
      if (d.size < 8) ctx.addIssue({ code: "custom", path: ["size"], message: "Минимум 8 игроков" });
      if (d.size > SIZE_CAP) ctx.addIssue({ code: "custom", path: ["size"], message: `Максимум ${SIZE_CAP}` });
    }
    // participantMode forcing (D1): americano/mexicano = singles only.
    if ((d.format === "americano" || d.format === "mexicano") && d.participantMode !== "singles")
      ctx.addIssue({
        code: "custom",
        path: ["participantMode"],
        message: "Американо/Мексикано — только одиночная регистрация",
      });
    // scoringMode (D3): americano/mexicano use points, not sets.
    if ((d.format === "americano" || d.format === "mexicano") && d.scoringMode === "sets")
      ctx.addIssue({
        code: "custom",
        path: ["scoringMode"],
        message: "Для американо/мексикано используйте режим очков",
      });
    // points-mode: explicit targetPoints must be > 0 (else server defaults 24).
    if (d.scoringMode === "points" && d.targetPoints !== undefined && d.targetPoints <= 0)
      ctx.addIssue({ code: "custom", path: ["targetPoints"], message: "Целевые очки > 0" });
    // mexicano materializes one round at a time and only auto-finishes when
    // roundNumber >= totalRounds (round-result.ts isLastRound). With totalRounds=null
    // that branch is unreachable → the tournament never terminates (WR-01). Require it.
    // (americano derives N−1 rounds from the circle method and ignores totalRounds — IN-02.)
    if (d.format === "mexicano" && d.totalRounds == null)
      ctx.addIssue({ code: "custom", path: ["totalRounds"], message: "Укажите число раундов" });
  });

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export type TournamentFieldKey =
  | "name"
  | "format"
  | "participantMode"
  | "level"
  | "size"
  | "price"
  | "scoringMode"
  | "targetPoints"
  | "totalRounds"
  | "setsPerMatch"
  | "gamesPerSet"
  | "date"
  | "location";

export type ParseTournamentFormResult =
  | { ok: true; data: CreateTournamentInput }
  | { ok: false; errors: Partial<Record<TournamentFieldKey, string>> };

// Single source of truth for reading + validating the create form, mirroring
// parseProfileForm's discriminated shape (used by both client UX pre-validation
// and the server action security boundary so the two cannot drift).
export function parseTournamentForm(formData: FormData): ParseTournamentFormResult {
  const parsed = createTournamentSchema.safeParse({
    name: formData.get("name"),
    format: formData.get("format"),
    participantMode: formData.get("participantMode"),
    level: formData.get("level"),
    size: formData.get("size"),
    // Optional numerics: "" → undefined so z.coerce.optional() does not reject blanks.
    price: formData.get("price") || undefined,
    scoringMode: formData.get("scoringMode"),
    targetPoints: formData.get("targetPoints") || undefined,
    totalRounds: formData.get("totalRounds") || undefined,
    setsPerMatch: formData.get("setsPerMatch") || undefined,
    gamesPerSet: formData.get("gamesPerSet") || undefined,
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
