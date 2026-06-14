"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tournamentFormats, participantModes } from "@/lib/validation/tournament";
import { skillLevels, formatLabels, tournamentKindLabels, skillLevelLabels } from "@/lib/validation/auth";

// Client leaf for the collapsed-filters popover (004). The ONLY client logic here
// is popover open/close + outside-click + the .fcount active-facet badge + pushing
// the chosen facets into the URL searchParams. Filtering itself is SERVER-SIDE: the
// Server Component re-queries Prisma from these params. The sketch's [hidden]
// row-hiding engine is NOT ported.

type Props = {
  status: string;
  format: string;
  level: string;
  mode: string;
  q: string;
  shown: number;
};

// Status <option> values are raw DB strings; the rest are DB enum values mapped to
// RU labels via the existing label maps (no re-derived RU vocab).
const statusOptions = [
  { value: "registration", label: "Регистрация" },
  { value: "in_progress", label: "Идёт" },
  { value: "finished", label: "Завершён" },
];

export function FilterBar({ status, format, level, mode, q, shown }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  // current (uncommitted) field values, seeded from the URL-derived props
  const [s, setS] = useState({ q, status, format, level, mode });

  useEffect(() => {
    setS({ q, status, format, level, mode });
  }, [q, status, format, level, mode]);

  // close popover on outside-click
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // active-facet count (search excluded — sketch counts non-`all` selects only)
  const fcount = [s.status, s.format, s.level, s.mode].filter(Boolean).length;

  function buildUrl(next: typeof s): string {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.status) params.set("status", next.status);
    if (next.format) params.set("format", next.format);
    if (next.level) params.set("level", next.level);
    if (next.mode) params.set("mode", next.mode);
    const qs = params.toString();
    return qs ? `/tournaments?${qs}` : "/tournaments";
  }

  function submit(next: typeof s) {
    setS(next);
    router.push(buildUrl(next));
  }

  function reset() {
    const cleared = { q: "", status: "", format: "", level: "", mode: "" };
    setS(cleared);
    setOpen(false);
    router.push("/tournaments");
  }

  return (
    <div className="filters" ref={filtersRef}>
      <form
        className="filterbar"
        onSubmit={(e) => {
          e.preventDefault();
          submit(s);
        }}
      >
        <div className="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input"
            type="search"
            name="q"
            value={s.q}
            placeholder="Поиск по названию или месту…"
            onChange={(e) => setS({ ...s, q: e.target.value })}
            aria-label="Поиск турниров"
          />
          {s.q ? (
            <button
              type="button"
              className="clr show"
              title="Очистить"
              onClick={() => submit({ ...s, q: "" })}
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className={`filter-btn${open ? " on" : ""}`}
          aria-expanded={open}
          aria-controls="fpanel"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          Фильтры
          <span className="fcount" hidden={fcount === 0}>
            {fcount}
          </span>
        </button>
      </form>

      <div className={`filter-panel${open ? " open" : ""}`} id="fpanel">
        <div className="selrow">
          <div className="sel-field">
            <span className="label">Статус</span>
            <select className="sel" value={s.status} onChange={(e) => submit({ ...s, status: e.target.value })}>
              <option value="">Любой статус</option>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sel-field">
            <span className="label">Формат</span>
            <select className="sel" value={s.format} onChange={(e) => submit({ ...s, format: e.target.value })}>
              <option value="">Любой формат</option>
              {tournamentFormats.map((f) => (
                <option key={f} value={f}>
                  {formatLabels[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="sel-field">
            <span className="label">Уровень</span>
            <select className="sel" value={s.level} onChange={(e) => submit({ ...s, level: e.target.value })}>
              <option value="">Любой уровень</option>
              {skillLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {skillLevelLabels[lvl]}
                </option>
              ))}
            </select>
          </div>
          <div className="sel-field">
            <span className="label">Вид</span>
            <select className="sel" value={s.mode} onChange={(e) => submit({ ...s, mode: e.target.value })}>
              <option value="">Любой вид</option>
              {participantModes.map((m) => (
                <option key={m} value={m}>
                  {tournamentKindLabels[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-foot">
          <div className="res">
            Найдено <b>{shown}</b>
          </div>
          <button type="button" className="reset-btn" onClick={reset}>
            Сбросить фильтры
          </button>
        </div>
      </div>
    </div>
  );
}
