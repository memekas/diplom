"use client";

import { useActionState } from "react";
import { parseTournamentForm, tournamentSizes } from "@/lib/validation/tournament";
import {
  createTournamentAction,
  type CreateTournamentActionState,
} from "../actions";

// Interactive leaf only (Pitfall 11): the page stays a Server Component, this
// form is the single "use client" boundary. Submits via createTournamentAction;
// the client-side parseTournamentForm pre-check is UX-only — the action
// re-validates server-side (and re-checks requireAdmin) as the real boundary.
export function CreateTournamentForm() {
  const [state, formAction, pending] = useActionState<CreateTournamentActionState, FormData>(
    async (prev, formData) => {
      // Client-side pre-validation for fast feedback (shares the schema with the
      // server action so the two cannot drift). Not the security check.
      const parsed = parseTournamentForm(formData);
      if (!parsed.ok) {
        return { ok: false, errors: parsed.errors };
      }
      return createTournamentAction(prev, formData);
    },
    null,
  );

  const errors = state && state.ok === false ? state.errors : {};

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      {errors.form && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{errors.form}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Название
        <input
          name="name"
          type="text"
          required
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.name && <span className="text-xs text-red-600">{errors.name}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Размер сетки
        <select
          name="size"
          defaultValue={tournamentSizes[0]}
          className="rounded-md border border-current/30 px-3 py-2"
        >
          {tournamentSizes.map((size) => (
            <option key={size} value={size}>
              {size} пар
            </option>
          ))}
        </select>
        {errors.size && <span className="text-xs text-red-600">{errors.size}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Дата <span className="opacity-50">(необязательно)</span>
        <input
          name="date"
          type="datetime-local"
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.date && <span className="text-xs text-red-600">{errors.date}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Место <span className="opacity-50">(необязательно)</span>
        <input
          name="location"
          type="text"
          className="rounded-md border border-current/30 px-3 py-2"
        />
        {errors.location && <span className="text-xs text-red-600">{errors.location}</span>}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Создание…" : "Создать турнир"}
      </button>
    </form>
  );
}
