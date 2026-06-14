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
  const [showPassword, setShowPassword] = useState(false);

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
    <form onSubmit={onSubmit} className="authform" noValidate>
      <div className="field">
        <label className="label" htmlFor="reg-email">
          Почта
        </label>
        <input id="reg-email" name="email" type="email" autoComplete="email" className="input" required />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>

      <div className="field">
        <label className="label" htmlFor="reg-password">
          Пароль
        </label>
        <div className="pw">
          <input
            id="reg-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className="input"
            required
          />
          <button
            type="button"
            className={showPassword ? "reveal on" : "reveal"}
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        <span className="hint">Минимум 8 символов</span>
        {errors.password && <span className="error">{errors.password}</span>}
      </div>

      <div className="field">
        <label className="label" htmlFor="reg-name">
          Имя (ФИО)
        </label>
        <input id="reg-name" name="name" type="text" autoComplete="name" className="input" required />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>

      <div className="field">
        <label className="label" htmlFor="reg-nickname">
          Никнейм
        </label>
        <input id="reg-nickname" name="nickname" type="text" autoComplete="username" className="input" required />
        <span className="hint">Уникальный, 3–30 символов: буквы, цифры, _ и -</span>
        {errors.nickname && <span className="error">{errors.nickname}</span>}
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="reg-phone">
            Телефон <span className="opt">(необязательно)</span>
          </label>
          <input id="reg-phone" name="phone" type="tel" autoComplete="tel" className="input" />
          {errors.phone && <span className="error">{errors.phone}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="reg-birthDate">
            Дата рождения <span className="opt">(необязательно)</span>
          </label>
          <input id="reg-birthDate" name="birthDate" type="date" className="input" />
          {errors.birthDate && <span className="error">{errors.birthDate}</span>}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="reg-skillLevel">
          Уровень
        </label>
        <div className="sel-wrap">
          <select id="reg-skillLevel" name="skillLevel" defaultValue="" required className="input">
            <option value="" disabled>
              Выберите уровень
            </option>
            {skillLevels.map((lvl) => (
              <option key={lvl} value={lvl}>
                {skillLevelLabels[lvl]}
              </option>
            ))}
          </select>
        </div>
        {errors.skillLevel && <span className="error">{errors.skillLevel}</span>}
      </div>

      {errors.form && <p className="error">{errors.form}</p>}

      <button type="submit" disabled={submitting} className="btn btn-primary btn-block" style={{ marginTop: 4 }}>
        {submitting ? "Создаём аккаунт…" : "Зарегистрироваться"}
      </button>
    </form>
  );
}
