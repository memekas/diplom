"use client";

import { useActionState, useState } from "react";
import {
  parseTournamentForm,
  tournamentFormats,
  participantModes,
  scoringModes,
  PLAYOFF_SIZES,
} from "@/lib/validation/tournament";
import {
  skillLevels,
  formatLabels,
  tournamentKindLabels,
  skillLevelLabels,
} from "@/lib/validation/auth";
import {
  createTournamentAction,
  type CreateTournamentActionState,
} from "../actions";

// RU labels for scoring mode (display-only; FormData/DB stay latin).
const scoringModeLabels: Record<(typeof scoringModes)[number], string> = {
  sets: "Сеты/геймы",
  points: "Очки",
};

// Advisory client-side size minimums (server superRefine is authoritative).
const sizeMinByFormat: Record<(typeof tournamentFormats)[number], number> = {
  playoff: 4,
  round_robin: 3,
  americano: 4,
  mexicano: 8,
};

const inputClass = "rounded-md border border-current/30 px-3 py-2";
const fieldErrorClass = "text-xs text-red-400";

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

  // Client field-visibility state. americano/mexicano force singles + points.
  const [format, setFormat] = useState<(typeof tournamentFormats)[number]>("playoff");
  const [scoringMode, setScoringMode] = useState<(typeof scoringModes)[number]>("sets");

  const isRoundFormat = format === "americano" || format === "mexicano";
  // Effective (forced) values for the controlled selects.
  const effectiveMode = isRoundFormat ? "singles" : undefined;
  const effectiveScoring = isRoundFormat ? "points" : scoringMode;

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      {errors.form && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">{errors.form}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Название
        <input name="name" type="text" required className={inputClass} />
        {errors.name && <span className={fieldErrorClass}>{errors.name}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Формат
        <select
          name="format"
          value={format}
          onChange={(e) => setFormat(e.target.value as (typeof tournamentFormats)[number])}
          className={inputClass}
        >
          {tournamentFormats.map((f) => (
            <option key={f} value={f}>
              {formatLabels[f]}
            </option>
          ))}
        </select>
        {errors.format && <span className={fieldErrorClass}>{errors.format}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Тип
        {/* Disabled selects do not submit; a hidden input carries the forced value. */}
        {effectiveMode && <input type="hidden" name="participantMode" value={effectiveMode} />}
        <select
          {...(effectiveMode
            ? { value: effectiveMode, disabled: true }
            : { name: "participantMode", defaultValue: "pairs" })}
          className={inputClass}
        >
          {participantModes.map((m) => (
            <option key={m} value={m}>
              {tournamentKindLabels[m]}
            </option>
          ))}
        </select>
        {errors.participantMode && (
          <span className={fieldErrorClass}>{errors.participantMode}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Уровень
        <select name="level" defaultValue={skillLevels[0]} required className={inputClass}>
          {skillLevels.map((lvl) => (
            <option key={lvl} value={lvl}>
              {skillLevelLabels[lvl]}
            </option>
          ))}
        </select>
        {errors.level && <span className={fieldErrorClass}>{errors.level}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {format === "playoff" ? "Размер сетки" : "Количество участников"}
        {format === "playoff" ? (
          <select name="size" defaultValue={PLAYOFF_SIZES[0]} className={inputClass}>
            {PLAYOFF_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} пар
              </option>
            ))}
          </select>
        ) : (
          <input
            name="size"
            type="number"
            min={sizeMinByFormat[format]}
            required
            className={inputClass}
          />
        )}
        {errors.size && <span className={fieldErrorClass}>{errors.size}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Цена, ₽ <span className="opacity-50">(необязательно)</span>
        <input name="price" type="number" min={0} className={inputClass} />
        {errors.price && <span className={fieldErrorClass}>{errors.price}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Подсчёт очков
        {/* Disabled select does not submit; a hidden input carries the forced value. */}
        {isRoundFormat && <input type="hidden" name="scoringMode" value={effectiveScoring} />}
        <select
          {...(isRoundFormat ? {} : { name: "scoringMode" })}
          value={effectiveScoring}
          onChange={(e) => setScoringMode(e.target.value as (typeof scoringModes)[number])}
          disabled={isRoundFormat}
          className={inputClass}
        >
          {scoringModes.map((m) => (
            <option key={m} value={m}>
              {scoringModeLabels[m]}
            </option>
          ))}
        </select>
        {errors.scoringMode && <span className={fieldErrorClass}>{errors.scoringMode}</span>}
      </label>

      {effectiveScoring === "sets" && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Сетов в матче
            <input name="setsPerMatch" type="number" min={1} className={inputClass} />
            {errors.setsPerMatch && (
              <span className={fieldErrorClass}>{errors.setsPerMatch}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Геймов в сете
            <input name="gamesPerSet" type="number" min={1} className={inputClass} />
            {errors.gamesPerSet && (
              <span className={fieldErrorClass}>{errors.gamesPerSet}</span>
            )}
          </label>
        </>
      )}

      {effectiveScoring === "points" && (
        <label className="flex flex-col gap-1 text-sm">
          Целевые очки <span className="opacity-50">(необязательно — по умолчанию 24)</span>
          <input name="targetPoints" type="number" min={1} className={inputClass} />
          {errors.targetPoints && (
            <span className={fieldErrorClass}>{errors.targetPoints}</span>
          )}
        </label>
      )}

      {isRoundFormat && (
        <label className="flex flex-col gap-1 text-sm">
          Число раундов
          <input
            name="totalRounds"
            type="number"
            min={1}
            required={format === "mexicano"}
            className={inputClass}
          />
          {errors.totalRounds && (
            <span className={fieldErrorClass}>{errors.totalRounds}</span>
          )}
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Дата <span className="opacity-50">(необязательно)</span>
        <input name="date" type="datetime-local" className={inputClass} />
        {errors.date && <span className={fieldErrorClass}>{errors.date}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Место <span className="opacity-50">(необязательно)</span>
        <input name="location" type="text" className={inputClass} />
        {errors.location && <span className={fieldErrorClass}>{errors.location}</span>}
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
