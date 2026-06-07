import { z } from "zod";
import { skillLevels } from "@/lib/validation/auth";

export const courtSides = ["left", "right", "either"] as const;

// Display-only RU labels (UI layer; DB/FormData stay latin). Schema/parsing untouched.
export const courtSideLabels: Record<(typeof courtSides)[number], string> = {
  left: "Левая",
  right: "Правая",
  either: "Любая",
};

// Profile edit schema (USR-03). Editable domain fields: name, courtSide, phone,
// skillLevel, birthDate, nickname, email. role is intentionally NOT here — role
// is never client-editable (Pitfall 8), and identity comes from the requireUser()
// guard, never from form data. email lives here for parsing/validation only; the
// action splits it out and routes it through auth.api.changeEmail (Better Auth
// owns email + session cookie — Pitfall 3), never a direct prisma update.
export const profileSchema = z.object({
  name: z.string().trim().min(1, "ФИО обязательно"),
  courtSide: z.enum(courtSides),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  skillLevel: z
    .enum(skillLevels)
    .optional()
    // Empty <select> value arrives as "" — treat as "no selection".
    .or(z.literal("").transform(() => undefined)),
  // Mirror registerSchema nickname rules (trim, 3–30, [A-Za-z0-9_-], no spaces).
  nickname: z
    .string()
    .trim()
    .min(3, "Минимум 3 символа")
    .max(30, "Максимум 30 символов")
    .regex(/^[A-Za-z0-9_-]+$/, "Только буквы, цифры, _ и -"),
  // Optional email. Empty string → undefined ("no change"). Same date-union trick
  // as createTournamentSchema for birthDate (RESEARCH Open Q1).
  email: z
    .email("Введите корректный email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  birthDate: z
    .union([z.literal(""), z.coerce.date()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export type ParseProfileFormResult =
  | { ok: true; data: ProfileInput }
  | {
      ok: false;
      errors: Partial<
        Record<
          "name" | "courtSide" | "phone" | "skillLevel" | "nickname" | "email" | "birthDate",
          string
        >
      >;
    };

// Single source of truth for reading + validating the profile form. Used by
// both the client form (UX pre-validation) and the server action (the real
// security boundary) so the two cannot drift on how formData is shaped or
// which fields are accepted.
export function parseProfileForm(formData: FormData): ParseProfileFormResult {
  const parsed = profileSchema.safeParse({
    name: formData.get("name") ?? undefined,
    courtSide: formData.get("courtSide"),
    phone: formData.get("phone") ?? undefined,
    skillLevel: formData.get("skillLevel") || undefined,
    nickname: formData.get("nickname") ?? undefined,
    email: formData.get("email") || undefined,
    birthDate: formData.get("birthDate") ?? undefined,
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
