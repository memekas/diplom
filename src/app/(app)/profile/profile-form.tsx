"use client";

import { useActionState, useEffect, useState } from "react";
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

type Fields = Omit<Initial, "email">;

// Diffable subset (email is read-only, never diffed).
function pickFields(i: Initial): Fields {
  return {
    name: i.name,
    nickname: i.nickname,
    courtSide: i.courtSide,
    phone: i.phone,
    skillLevel: i.skillLevel,
    birthDate: i.birthDate,
  };
}

// Interactive leaf only (Pitfall 11): the page stays a Server Component, this
// form is the single "use client" boundary. Submits via the updateProfileAction
// Server Action; client-side profileSchema parse is UX-only — the action
// re-validates server-side as the real boundary. The edit-toggle / diff-gated
// Save / per-field changed-dot / courtSide .seg are pure client UX on top of the
// SAME action — field names and the action contract are unchanged.
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

  // Edit mode + the diff baseline. `values` tracks the live form; `baseline` is
  // what we compare against (reset on successful save).
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState<Fields>(() => pickFields(initial));
  const [values, setValues] = useState<Fields>(() => pickFields(initial));

  // On a successful save, re-lock and re-baseline to the just-saved values.
  useEffect(() => {
    if (state?.ok) {
      setBaseline(values);
      setEditing(false);
    }
    // Only react to the action outcome flipping to ok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const set = <K extends keyof Fields>(key: K, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const changed = (key: keyof Fields) => values[key] !== baseline[key];
  const dirty = (Object.keys(values) as (keyof Fields)[]).some(changed);

  const locked = !editing;

  function startEdit() {
    setBaseline(pickFields(initial));
    setValues(pickFields(initial));
    setEditing(true);
  }
  function cancelEdit() {
    setValues(baseline);
    setEditing(false);
  }

  return (
    <section>
      <div className="form-head">
        <span className="eyebrow">Данные профиля</span>
        {locked && (
          <button type="button" className="edit-toggle" onClick={startEdit}>
            Редактировать
          </button>
        )}
      </div>

      <form action={formAction} className="card card-pad">
        {state?.ok && (
          <p
            style={{
              color: "var(--success)",
              background: "var(--success-soft)",
              border: "1px solid color-mix(in srgb, var(--success) 40%, transparent)",
              borderRadius: "var(--radius)",
              padding: "8px 13px",
              fontSize: ".85rem",
              fontWeight: "var(--fw-strong)",
            }}
          >
            Профиль сохранён
          </p>
        )}
        {errors.form && <p className="error">{errors.form}</p>}

        <div className="field" style={{ marginTop: state?.ok || errors.form ? 16 : 0 }}>
          <label className="label" htmlFor="name">
            ФИО
            {changed("name") && <span className="changed-dot" />}
          </label>
          <input
            id="name"
            className="input"
            name="name"
            type="text"
            autoComplete="name"
            required
            disabled={locked}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
          />
          {errors.name && <span className="error">{errors.name}</span>}
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label className="label" htmlFor="nickname">
            Никнейм
            {changed("nickname") && <span className="changed-dot" />}
          </label>
          <input
            id="nickname"
            className="input"
            name="nickname"
            type="text"
            autoComplete="username"
            required
            disabled={locked}
            value={values.nickname}
            onChange={(e) => set("nickname", e.target.value)}
          />
          <span className="hint">Виден соперникам по сетке. Уникальный, как @USER-01.</span>
          {errors.nickname && <span className="error">{errors.nickname}</span>}
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label className="label">
            Сторона корта
            {changed("courtSide") && <span className="changed-dot" />}
          </label>
          <div className={`seg${locked ? " locked" : ""}`} role="group" aria-label="Сторона корта">
            {courtSides.map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={values.courtSide === side}
                disabled={locked}
                onClick={() => set("courtSide", side)}
              >
                {courtSideLabels[side]}
              </button>
            ))}
          </div>
          {/* Hidden input keeps name="courtSide" so the action payload is identical. */}
          <input type="hidden" name="courtSide" value={values.courtSide} />
          {errors.courtSide && <span className="error">{errors.courtSide}</span>}
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label className="label" htmlFor="phone">
            Телефон <span className="opt">(необязательно)</span>
            {changed("phone") && <span className="changed-dot" />}
          </label>
          <input
            id="phone"
            className="input"
            name="phone"
            type="tel"
            autoComplete="tel"
            disabled={locked}
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
          {errors.phone && <span className="error">{errors.phone}</span>}
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label className="label" htmlFor="skillLevel">
            Уровень <span className="opt">(необязательно)</span>
            {changed("skillLevel") && <span className="changed-dot" />}
          </label>
          <div className="select-wrap">
            <select
              id="skillLevel"
              className="input"
              name="skillLevel"
              disabled={locked}
              value={values.skillLevel}
              onChange={(e) => set("skillLevel", e.target.value)}
            >
              <option value="">—</option>
              {skillLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {skillLevelLabels[lvl]}
                </option>
              ))}
            </select>
          </div>
          {errors.skillLevel && <span className="error">{errors.skillLevel}</span>}
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label className="label" htmlFor="birthDate">
            Дата рождения <span className="opt">(необязательно)</span>
            {changed("birthDate") && <span className="changed-dot" />}
          </label>
          <input
            id="birthDate"
            className="input"
            name="birthDate"
            type="date"
            disabled={locked}
            value={values.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
          />
          {errors.birthDate && <span className="error">{errors.birthDate}</span>}
        </div>

        {/* Email is the login — read-only. Kept present (name="email") so the
            action payload shape is unchanged; the action routes it via Better
            Auth changeEmail. Never an enabled editable input. */}
        <div className="field" style={{ marginTop: 16 }}>
          <label className="label" htmlFor="email">
            Email <span className="opt">(логин)</span>
          </label>
          <input
            id="email"
            className="input"
            name="email"
            type="email"
            autoComplete="email"
            disabled
            defaultValue={initial.email}
          />
          {errors.email && <span className="error">{errors.email}</span>}
        </div>

        <div className="form-foot" style={{ marginTop: 16 }}>
          <span className="grow" />
          {!locked && (
            <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
              Отмена
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={locked || !dirty || pending}>
            {pending ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </section>
  );
}
