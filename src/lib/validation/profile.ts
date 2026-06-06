import { z } from "zod";
import { skillLevels } from "@/lib/validation/auth";

export const courtSides = ["left", "right", "either"] as const;

// Profile edit schema (PLAYER-03). Only the display-only domain fields are
// editable: courtSide, phone, skillLevel. name/email/role are intentionally
// NOT here — role is never client-editable (Pitfall 8), and identity comes from
// the requireUser() guard, never from form data.
export const profileSchema = z.object({
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
});

export type ProfileInput = z.infer<typeof profileSchema>;

export type ParseProfileFormResult =
  | { ok: true; data: ProfileInput }
  | { ok: false; errors: Partial<Record<"courtSide" | "phone" | "skillLevel", string>> };

// Single source of truth for reading + validating the profile form. Used by
// both the client form (UX pre-validation) and the server action (the real
// security boundary) so the two cannot drift on how formData is shaped or
// which fields are accepted.
export function parseProfileForm(formData: FormData): ParseProfileFormResult {
  const parsed = profileSchema.safeParse({
    courtSide: formData.get("courtSide"),
    phone: formData.get("phone") ?? undefined,
    skillLevel: formData.get("skillLevel") || undefined,
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
