"use client";

import { useActionState, useState } from "react";
import "./create-tournament.css";
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
    <form action={formAction} className="cq w-full max-w-[640px]">
      {errors.form && <p className="error">{errors.form}</p>}

      {/* ── 1 · Основное ─────────────────────────────────────────── */}
      <fieldset className="fset sec">
        <div className="sec-head">
          <span className="sec-num">1</span>
          <span className="eyebrow">Основное</span>
          <hr className="net-rule" />
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-name">
            Название
          </label>
          <input id="ct-name" name="name" type="text" required className="input" />
          {errors.name && <span className="error">{errors.name}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-format">
            Формат
          </label>
          <div className="sel-wrap">
            <select
              id="ct-format"
              name="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as (typeof tournamentFormats)[number])}
              className="input"
            >
              {tournamentFormats.map((f) => (
                <option key={f} value={f}>
                  {formatLabels[f]}
                </option>
              ))}
            </select>
          </div>
          {errors.format && <span className="error">{errors.format}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-mode">
            Тип
          </label>
          {/* Disabled selects do not submit; a hidden input carries the forced value.
              Kept as a controlled select+hidden-input (not a .seg radio) so the
              forced americano/mexicano singles value posts reliably — pattern risk #2. */}
          {effectiveMode && <input type="hidden" name="participantMode" value={effectiveMode} />}
          <div className="sel-wrap">
            <select
              id="ct-mode"
              {...(effectiveMode
                ? { value: effectiveMode, disabled: true }
                : { name: "participantMode", defaultValue: "pairs" })}
              className="input"
            >
              {participantModes.map((m) => (
                <option key={m} value={m}>
                  {tournamentKindLabels[m]}
                </option>
              ))}
            </select>
          </div>
          {isRoundFormat && (
            <span className="seg-lock">Формат играется только одиночно</span>
          )}
          {errors.participantMode && <span className="error">{errors.participantMode}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-level">
            Уровень
          </label>
          <div className="sel-wrap">
            <select
              id="ct-level"
              name="level"
              defaultValue={skillLevels[0]}
              required
              className="input"
            >
              {skillLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {skillLevelLabels[lvl]}
                </option>
              ))}
            </select>
          </div>
          {errors.level && <span className="error">{errors.level}</span>}
        </div>
      </fieldset>

      {/* ── 2 · Формат и подсчёт ─────────────────────────────────── */}
      <fieldset className="fset sec">
        <div className="sec-head">
          <span className="sec-num">2</span>
          <span className="eyebrow">Формат и подсчёт</span>
          <hr className="net-rule" />
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-size">
            {format === "playoff" ? "Размер сетки" : "Количество участников"}
          </label>
          {/* Render EXACTLY ONE control so only the visible one carries name="size"
              (never a double-submit). */}
          {format === "playoff" ? (
            <div className="sel-wrap">
              <select id="ct-size" name="size" defaultValue={PLAYOFF_SIZES[0]} className="input">
                {PLAYOFF_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} пар
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input
              id="ct-size"
              name="size"
              type="number"
              min={sizeMinByFormat[format]}
              required
              className="input"
            />
          )}
          {errors.size && <span className="error">{errors.size}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-scoring">
            Подсчёт очков
          </label>
          {/* Disabled select does not submit; a hidden input carries the forced value. */}
          {isRoundFormat && <input type="hidden" name="scoringMode" value={effectiveScoring} />}
          <div className="sel-wrap">
            <select
              id="ct-scoring"
              {...(isRoundFormat ? {} : { name: "scoringMode" })}
              value={effectiveScoring}
              onChange={(e) => setScoringMode(e.target.value as (typeof scoringModes)[number])}
              disabled={isRoundFormat}
              className="input"
            >
              {scoringModes.map((m) => (
                <option key={m} value={m}>
                  {scoringModeLabels[m]}
                </option>
              ))}
            </select>
          </div>
          {isRoundFormat && <span className="seg-lock">Подсчёт — только очки</span>}
          {errors.scoringMode && <span className="error">{errors.scoringMode}</span>}
        </div>

        {/* Free-form scoring: no per-set / per-game / target-point inputs. The
            score is entered freely when recording each match. Only the scoringMode
            (sets|points) selector above is kept. */}

        {isRoundFormat && (
          <div className="field cond">
            <label className="label" htmlFor="ct-rounds">
              Число раундов{" "}
              {format === "mexicano" ? (
                <span className="req-tag">обязательно</span>
              ) : (
                <span className="opt-tag">необязательно</span>
              )}
            </label>
            <input
              id="ct-rounds"
              name="totalRounds"
              type="number"
              min={1}
              required={format === "mexicano"}
              className="input"
            />
            {errors.totalRounds && <span className="error">{errors.totalRounds}</span>}
          </div>
        )}
      </fieldset>

      {/* ── 3 · Время и место ────────────────────────────────────── */}
      <fieldset className="fset sec">
        <div className="sec-head">
          <span className="sec-num">3</span>
          <span className="eyebrow">Время и место</span>
          <hr className="net-rule" />
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-price">
            Цена, ₽ <span className="opt-tag">необязательно</span>
          </label>
          <input id="ct-price" name="price" type="number" min={0} className="input" />
          {errors.price && <span className="error">{errors.price}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-date">
            Дата <span className="opt-tag">необязательно</span>
          </label>
          <input id="ct-date" name="date" type="datetime-local" className="input" />
          {errors.date && <span className="error">{errors.date}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-location">
            Место <span className="opt-tag">необязательно</span>
          </label>
          <input id="ct-location" name="location" type="text" className="input" />
          {errors.location && <span className="error">{errors.location}</span>}
        </div>
      </fieldset>

      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
        {pending ? "Создание…" : "Создать турнир"}
      </button>
    </form>
  );
}
