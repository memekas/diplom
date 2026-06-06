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
