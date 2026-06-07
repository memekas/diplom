"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { registerSchema, skillLevels, skillLevelLabels } from "@/lib/validation/auth";

type FieldErrors = Partial<
  Record<
    "email" | "password" | "name" | "nickname" | "phone" | "skillLevel" | "birthDate" | "form",
    string
  >
>;

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const parsed = registerSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      name: fd.get("name"),
      nickname: fd.get("nickname"),
      phone: fd.get("phone"),
      skillLevel: fd.get("skillLevel") || undefined,
      birthDate: fd.get("birthDate") ?? undefined,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    const { email, password, name, nickname, phone, skillLevel, birthDate } = parsed.data;
    // nickname is required (additionalFields required:true); phone is optional and
    // spread conditionally. skillLevel is now EXPLICITLY required + validated above
    // (no "beginner" fallback — the default-slip failed level-equality at pair
    // registration). birthDate is optional, sent as an ISO string into the
    // string-typed additionalField. courtSide is NOT collected here — it defaults
    // server-side.
    const { error } = await authClient.signUp.email({
      email,
      password,
      name,
      nickname,
      skillLevel,
      ...(phone ? { phone } : {}),
      ...(birthDate ? { birthDate: birthDate.toISOString() } : {}),
    });

    if (error) {
      setSubmitting(false);
      // Branch on the stable error.code, NOT error.message (English). A nickname
      // unique collision surfaces as FAILED_TO_CREATE_USER (the only create-time
      // unique field besides the pre-checked email — Research Finding 1b/A1).
      if (error.code === "FAILED_TO_CREATE_USER") {
        setErrors({ form: "Никнейм уже занят" });
      } else if (error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
        setErrors({ form: "Этот email уже зарегистрирован" });
      } else {
        setErrors({ form: "Не удалось зарегистрироваться" });
      }
      return;
    }

    // Better Auth auto-signs-in (email verification disabled).
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4" noValidate>
      {errors.form && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">{errors.form}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Почта
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="rounded-md border border-current/30 px-3 py-2"
          required
        />
        {errors.email && <span className="text-xs text-red-400">{errors.email}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Пароль
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          className="rounded-md border border-current/30 px-3 py-2"
          required
        />
        {errors.password && <span className="text-xs text-red-400">{errors.password}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Имя (ФИО)
        <input
          name="name"
          type="text"
          autoComplete="name"
          className="rounded-md border border-current/30 px-3 py-2"
          required
        />
        {errors.name && <span className="text-xs text-red-400">{errors.name}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Никнейм
        <input
          name="nickname"
          type="text"
          autoComplete="username"
          className="rounded-md border border-current/30 px-3 py-2"
          required
        />
        {errors.nickname && <span className="text-xs text-red-400">{errors.nickname}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Телефон <span className="opacity-50">(необязательно)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.phone && <span className="text-xs text-red-400">{errors.phone}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Дата рождения <span className="opacity-50">(необязательно)</span>
        <input
          name="birthDate"
          type="date"
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.birthDate && <span className="text-xs text-red-400">{errors.birthDate}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Уровень
        <select
          name="skillLevel"
          defaultValue=""
          required
          className="rounded-md border border-current/30 px-3 py-2"
        >
          <option value="" disabled>
            Выберите уровень
          </option>
          {skillLevels.map((lvl) => (
            <option key={lvl} value={lvl}>
              {skillLevelLabels[lvl]}
            </option>
          ))}
        </select>
        {errors.skillLevel && <span className="text-xs text-red-400">{errors.skillLevel}</span>}
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? "Создаём аккаунт…" : "Зарегистрироваться"}
      </button>
    </form>
  );
}
