# Phase 12: Дизайн-фундамент (Court) - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss, autonomous mode — grey areas decided at Claude's discretion, grounded in the locked design contract)

<domain>
## Phase Boundary

Реализовать дизайн-фундамент **Court** в реальном приложении (Next 16 + Tailwind 4), на котором будут строиться все экраны фаз 13–14. В рамках фазы: токены темы Court, шрифты, компонентный слой (`.card/.btn/.field/.badge/.meta/.progress/...`), базовый адаптив через container-queries, и перевод глобальной оболочки (body, шрифты, `Nav`) с монохрома на Court.

НЕ входит: пер-экранный рестайл (auth, список, профиль, дашборд, страница турнира, сетка, форматные страницы) — это фазы 13 и 14. Здесь только фундамент + общая оболочка.

**Источник истины:** skill `sketch-findings-diplom` (`references/foundation.md` + `sources/_base.css` + `sources/themes/court.css`). Реализация должна 1:1 соответствовать токен-контракту и именам классов из скетчей, чтобы фазы 13/14 могли переносить разметку из `sources/NNN-*/index.html` без переименований.
</domain>

<decisions>
## Implementation Decisions

### Токены и тема (Tailwind 4 @theme)
- Перенести полный токен-контракт Court из `sources/themes/court.css` в `src/app/globals.css` через Tailwind 4 `@theme` (CSS custom properties = дизайн-токены). Сохранить существующий паттерн `--background/--foreground` как часть набора.
- Имена токенов сохранить как в `_base.css` (surfaces/text/brand/status/type/shape): `--page, --bg, --surface, --surface-2, --border, --border-strong, --ring, --text, --text-muted, --text-faint, --on-primary, --primary, --primary-2, --primary-soft, --accent, --accent-2, --danger/-soft, --success/-soft, --winner-bg/-text, --badge-*-bg/-fg, --radius/-lg/-pill, --shadow/-lg, --card-blur` и шрифтовые `--font-display/-body/-mono`, веса/трекинг.
- Editorial/Glass НЕ переносим в приложение — в продакшн идёт только Court (альтернативы остаются в скетчах как референс).
- Захардкоженных hex в коде быть не должно — всё через токены (анти-паттерн из foundation.md).

### Шрифты
- Oswald (display), Inter (body), JetBrains Mono (цифры/счёт) через `next/font/google` в `layout.tsx`, экспонировать как CSS-переменные `--font-display/--font-body/--font-mono` (идиома Next, без FOUT). Кириллица — подключить subset `cyrillic`.

### Компонентный слой (_base)
- Перенести компонентные классы из `sources/_base.css` в приложение через `@layer components` в `globals.css` (или отдельный импортируемый css), token-driven. Имена классов идентичны скетчам: `.card/.card-pad/.surface-2/.btn/.btn-primary/.btn-ghost/.btn-block/.field/.label/.input/.hint/.error/.badge(+.badge-reg/-prog/-fin)/.pill/.pill-accent/.avatar/.meta/.meta-row/.meta-key/.meta-val/.progress/.empty`.
- Sketch-chrome (`#variant-nav`, `#sketch-tools`, `.variant`) НЕ переносим — это инструментарий скетчей.

### Адаптив (container queries)
- Установить базовый паттерн: контейнер-обёртка с `container-type: inline-size` + использование `@container` (не `@media`) — как в скетчах. Корневой layout не форсит единый `.app`; вместо этого фундамент предоставляет утилиту/конвенцию, а пер-экранные обёртки получают `container-type` в фазах 13/14. Базовую корректность (≤375px без непреднамеренного скролла) проверить на оболочке.

### Глобальная оболочка
- `body`: фон `--page` (Court court-поле), цвет `--text`, шрифт `--font-body`.
- `Nav` (`src/components/nav.tsx`) — минимальный рестайл под Court (токены), как глобальная хрома. Без изменения структуры навигации/ссылок.
- `tournament-status-badge.tsx` при необходимости привести к `.badge-*` маппингу (Регистрация→reg, Идёт→prog, Завершён→fin), т.к. это переиспользуемый компонент-фундамент.

### Claude's Discretion
- Точная организация globals.css (один файл vs импорт компонентного слоя), порядок `@theme`/`@layer`, имена утилит — на усмотрение, при условии соответствия токен-контракту и именам классов скетчей.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/globals.css` — Tailwind 4 (`@import "tailwindcss"`) + `:root` vars + `@theme inline` mapping + `body`. Точка входа для токенов/слоя.
- `src/app/layout.tsx` — `<html lang="ru" className="h-full antialiased"><body className="min-h-full flex flex-col"><Nav/>{children}</body>`. Шрифты не настроены (system-ui). Точка для `next/font`.
- `src/components/nav.tsx`, `src/components/tournament-status-badge.tsx` — глобальные/переиспользуемые компоненты.
- Дизайн-источники в skill: `.claude/skills/sketch-findings-diplom/sources/_base.css`, `sources/themes/court.css`, `references/foundation.md`.

### Established Patterns
- Tailwind 4 через `@tailwindcss/postcss` (`postcss.config.mjs`); CSS-first, без `tailwind.config.js`.
- Server Components + Server Actions; интерактивные листья — единственные `"use client"`.

### Integration Points
- `globals.css` (токены + слой), `layout.tsx` (шрифты + возможный контейнер), `nav.tsx` / `tournament-status-badge.tsx` (фундаментная хрома).
</code_context>

<specifics>
## Specific Ideas

- 1:1 соответствие токенам и именам классов скетчей — критично: фазы 13/14 переносят разметку из `sources/NNN-*/index.html`.
- Court-палитра: court-поле (тёмный teal-градиент `--page`), ball-green `--primary`, court-cyan `--accent`; Oswald/Inter/JetBrains Mono.
- Контейнер-запросы вместо media-queries (ключевое решение фазы скетчей).
</specifics>

<deferred>
## Deferred Ideas

- Пер-экранный рестайл (auth, browse, профиль, дашборд, страница турнира, создание, сетка, форматные страницы) → фазы 13–14.
- Editorial/Glass темы в приложении → вне рамок (Court — единственная продакшн-тема).
</deferred>
