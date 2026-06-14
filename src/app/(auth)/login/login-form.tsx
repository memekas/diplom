"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/lib/validation/auth";

type FieldErrors = Partial<Record<"email" | "password" | "form", string>>;

export function LoginForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
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
    const { error } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      setSubmitting(false);
      setErrors({ form: "Неверная почта или пароль" });
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="authform" noValidate>
      <div className="field">
        <label className="label" htmlFor="login-email">
          Почта
        </label>
        <input id="login-email" name="email" type="email" autoComplete="email" className="input" required />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>

      <div className="field">
        <label className="label" htmlFor="login-password">
          Пароль
        </label>
        <div className="pw">
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
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
        {errors.password && <span className="error">{errors.password}</span>}
      </div>

      {errors.form && <p className="error">{errors.form}</p>}

      <button type="submit" disabled={submitting} className="btn btn-primary btn-block" style={{ marginTop: 4 }}>
        {submitting ? "Вход…" : "Войти"}
      </button>
    </form>
  );
}
