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
      setErrors({ form: error.message ?? "Invalid email or password" });
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4" noValidate>
      {errors.form && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{errors.form}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="rounded-md border border-current/30 px-3 py-2"
          required
        />
        {errors.email && <span className="text-xs text-red-600">{errors.email}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="rounded-md border border-current/30 px-3 py-2"
          required
        />
        {errors.password && <span className="text-xs text-red-600">{errors.password}</span>}
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}
