"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { registerSchema, skillLevels } from "@/lib/validation/auth";

type FieldErrors = Partial<
  Record<"email" | "password" | "name" | "phone" | "skillLevel" | "form", string>
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
      phone: fd.get("phone"),
      skillLevel: fd.get("skillLevel") || undefined,
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
    const { email, password, name, phone, skillLevel } = parsed.data;
    // additionalFields phone/skillLevel flow through Better Auth signUp.
    // The preferred-side field is NOT collected here — it defaults server-side.
    const { error } = await authClient.signUp.email({
      email,
      password,
      name,
      ...(phone ? { phone } : {}),
      ...(skillLevel ? { skillLevel } : {}),
    });

    if (error) {
      setSubmitting(false);
      setErrors({ form: error.message ?? "Registration failed" });
      return;
    }

    // Better Auth auto-signs-in (email verification disabled).
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
          autoComplete="new-password"
          className="rounded-md border border-current/30 px-3 py-2"
          required
        />
        {errors.password && <span className="text-xs text-red-600">{errors.password}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          type="text"
          autoComplete="name"
          className="rounded-md border border-current/30 px-3 py-2"
          required
        />
        {errors.name && <span className="text-xs text-red-600">{errors.name}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Phone <span className="opacity-50">(optional)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.phone && <span className="text-xs text-red-600">{errors.phone}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Skill level <span className="opacity-50">(optional)</span>
        <select
          name="skillLevel"
          defaultValue=""
          className="rounded-md border border-current/30 px-3 py-2"
        >
          <option value="">—</option>
          {skillLevels.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>
        {errors.skillLevel && <span className="text-xs text-red-600">{errors.skillLevel}</span>}
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? "Creating account…" : "Register"}
      </button>
    </form>
  );
}
