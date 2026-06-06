import { z } from "zod";

export const skillLevels = ["beginner", "intermediate", "advanced", "pro"] as const;

export const registerSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
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
  skillLevel: z.enum(skillLevels).optional(),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
