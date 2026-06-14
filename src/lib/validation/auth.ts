import { z } from "zod";
import { tournamentFormats, participantModes } from "@/lib/validation/tournament";

export const skillLevels = ["beginner", "progressing", "intermediate", "advanced", "pro"] as const;

export type SkillLevel = (typeof skillLevels)[number];

// Display-only RU labels (UI layer; DB/FormData stay latin — level_key_decision).
export const skillLevelLabels: Record<(typeof skillLevels)[number], string> = {
  beginner: "новичок",
  progressing: "прогрессирующий",
  intermediate: "средний",
  advanced: "высокий",
  pro: "профессиональный",
};

// Display-only RU labels for tournament format. Keys are typed against the zod
// tuple from tournament.ts so they stay in sync. Reused by Phase 10 plan 02
// (home cards) + Phase 11.
export const formatLabels: Record<(typeof tournamentFormats)[number], string> = {
  playoff: "Олимпийская",
  round_robin: "Круговой",
  americano: "Американо",
  mexicano: "Мексикано",
};

// Display-only RU labels for participant mode (kind of tournament).
export const tournamentKindLabels: Record<(typeof participantModes)[number], string> = {
  pairs: "Парный",
  singles: "Одиночный",
};

export const registerSchema = z.object({
  email: z.email("Введите корректный email"),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
  name: z.string().min(1, "Имя обязательно"),
  // Required unique handle (USER-01/USER-02). trim + 3–30 + [A-Za-z0-9_-], no spaces.
  nickname: z
    .string()
    .trim()
    .min(3, "Минимум 3 символа")
    .max(30, "Максимум 30 символов")
    .regex(/^[A-Za-z0-9_-]+$/, "Только буквы, цифры, _ и -"),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  // Skill level is REQUIRED at registration (Phase 7 WR-01/IN-01): a missing
  // level is a validation error, NOT a silent "beginner" default — the
  // default-slip failed level-equality at pair registration.
  skillLevel: z.enum(skillLevels, { message: "Выберите уровень" }),
  // Optional date of birth. Same union trick as profileSchema: "" → undefined,
  // otherwise coerce to Date (RESEARCH A1; the form sends .toISOString() onward).
  birthDate: z
    .union([z.literal(""), z.coerce.date()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});

export const loginSchema = z.object({
  email: z.email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
