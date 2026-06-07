"use client";

import { useActionState } from "react";
import { skillLevels, skillLevelLabels } from "@/lib/validation/auth";
import { courtSides, courtSideLabels, parseProfileForm } from "@/lib/validation/profile";
import {
  updateProfileAction,
  type ProfileActionState,
} from "./actions";

type Initial = {
  name: string;
  email: string;
  nickname: string;
  courtSide: string;
  phone: string;
  skillLevel: string;
  birthDate: string;
};

// Interactive leaf only (Pitfall 11): the page stays a Server Component, this
// form is the single "use client" boundary. Submits via the updateProfileAction
// Server Action; client-side profileSchema parse is UX-only — the action
// re-validates server-side as the real boundary.
export function ProfileForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(
    async (prev, formData) => {
      // Client-side pre-validation for fast UX feedback (not the security
      // check). Shares parseProfileForm with the server action so the two
      // cannot drift on what is valid.
      const parsed = parseProfileForm(formData);
      if (!parsed.ok) {
        return { ok: false, errors: parsed.errors };
      }
      return updateProfileAction(prev, formData);
    },
    null,
  );

  const errors = state && state.ok === false ? state.errors : {};

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {state?.ok && (
        <p className="rounded-md bg-green-900/40 px-3 py-2 text-sm text-green-300">Сохранено.</p>
      )}
      {errors.form && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">{errors.form}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        ФИО
        <input
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={initial.name}
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.name && <span className="text-xs text-red-400">{errors.name}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Сторона корта
        <select
          name="courtSide"
          defaultValue={initial.courtSide}
          className="rounded-md border border-current/30 px-3 py-2"
        >
          {courtSides.map((side) => (
            <option key={side} value={side}>
              {courtSideLabels[side]}
            </option>
          ))}
        </select>
        {errors.courtSide && <span className="text-xs text-red-400">{errors.courtSide}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Телефон <span className="opacity-50">(необязательно)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={initial.phone}
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.phone && <span className="text-xs text-red-400">{errors.phone}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Уровень <span className="opacity-50">(необязательно)</span>
        <select
          name="skillLevel"
          defaultValue={initial.skillLevel}
          className="rounded-md border border-current/30 px-3 py-2"
        >
          <option value="">—</option>
          {skillLevels.map((lvl) => (
            <option key={lvl} value={lvl}>
              {skillLevelLabels[lvl]}
            </option>
          ))}
        </select>
        {errors.skillLevel && <span className="text-xs text-red-400">{errors.skillLevel}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Дата рождения <span className="opacity-50">(необязательно)</span>
        <input
          name="birthDate"
          type="date"
          defaultValue={initial.birthDate}
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.birthDate && <span className="text-xs text-red-400">{errors.birthDate}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Никнейм
        <input
          name="nickname"
          type="text"
          autoComplete="username"
          required
          defaultValue={initial.nickname}
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.nickname && <span className="text-xs text-red-400">{errors.nickname}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={initial.email}
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.email && <span className="text-xs text-red-400">{errors.email}</span>}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : "Сохранить"}
      </button>
    </form>
  );
}
