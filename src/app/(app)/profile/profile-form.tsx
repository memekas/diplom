"use client";

import { useActionState } from "react";
import { skillLevels } from "@/lib/validation/auth";
import { courtSides, parseProfileForm } from "@/lib/validation/profile";
import {
  updateProfileAction,
  type ProfileActionState,
} from "./actions";

type Initial = {
  courtSide: string;
  phone: string;
  skillLevel: string;
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
        <p className="rounded-md bg-green-100 px-3 py-2 text-sm text-green-800">Saved.</p>
      )}
      {errors.form && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{errors.form}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Court side
        <select
          name="courtSide"
          defaultValue={initial.courtSide}
          className="rounded-md border border-current/30 px-3 py-2"
        >
          {courtSides.map((side) => (
            <option key={side} value={side}>
              {side}
            </option>
          ))}
        </select>
        {errors.courtSide && <span className="text-xs text-red-600">{errors.courtSide}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Phone <span className="opacity-50">(optional)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={initial.phone}
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.phone && <span className="text-xs text-red-600">{errors.phone}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Skill level <span className="opacity-50">(optional)</span>
        <select
          name="skillLevel"
          defaultValue={initial.skillLevel}
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
        disabled={pending}
        className="mt-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
