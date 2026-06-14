# Phase 13: Auth, аккаунт и обзор - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss, autonomous mode — grey areas decided at Claude's discretion, grounded in the locked Court design contract and the v3.0 "restyle-only, preserve v2.0 behavior" constraint)

<domain>
## Phase Boundary

Перевести на дизайн-язык **Court** четыре экрана аккаунта/обзора, потребляя токены и компонентный слой (`_base`) из Phase 12: **вход/регистрация** (`(auth)/login`, `(auth)/register`), **профиль** (`(app)/profile`), **список турниров** (`(public)/tournaments`), **ЛК-дашборд** (`(app)/dashboard`). Читаемость на десктопе и на телефоне (~375px) через container-queries (`.cq` + `@container`, утилита из Phase 12).

**Источник истины:** skill `sketch-findings-diplom` — `references/forms-and-auth.md` (008 auth, 006 profile) + `references/lists-and-filters.md` (004 list, 005 dashboard) + `sources/008-auth/`, `sources/006-profile/`, `sources/004-tournaments-list/`, `sources/005-dashboard/` (+ `_base.css`, `themes/court.css`). Переносить разметку/классы 1:1 (имена классов уже в приложении из Phase 12).

**НЕ входит (Phase 14):** страница турнира (002), создание турнира (007), регистрация пары (001), сетка плей-офф (003), форматные страницы (009). Главная (`src/app/page.tsx`, HOME-01) — НЕ в этой фазе (см. Deferred).
</domain>

<decisions>
## Implementation Decisions

### Общий подход (все 4 экрана)
- Чистый рестайл: переносим court-разметку и `_base`-классы из соответствующих `sources/NNN-*/index.html`, НЕ трогая серверную логику, Server Actions, поля форм, валидацию, гейты ролей/readOnly. v2.0-поведение сохраняется.
- Каждый экранный wrapper получает `.cq` (утилита Phase 12: `container-type: inline-size`) — НЕ `.app`. Переносим анонимные `@container (max-width: …)` брейкпоинты из скетчей as-is (они резолвятся по ближайшему `container-type`-предку).
- Никаких захардкоженных hex — только токены Court (`--primary/--accent/--danger/--success/--text*` + `color-mix`). Касается и status-seam, и chevron-масок, и lookup/price-cue.
- Интерактив — только клиентские листья (`"use client"`), где это действительно нужно (см. ниже). Server Components остаются серверными; фильтрация и чтение данных — серверные.

### Auth (008 «Карточка с вкладками») — UI-02
- Сохраняем ДВА существующих роута (`(auth)/login`, `(auth)/register`) — НЕ объединяем в один. Это сохраняет v2.0-структуру и Server Actions нетронутыми.
- На обоих роутах рендерим court-карточку `.card` (≤440px, court-motiv на фоне) с `.modeseg` табами **Вход / Регистрация**: табы — это `<Link>` между роутами (активный таб = текущий роут), а НЕ in-place переключение через `body.is-login`. Визуально — таб-карточка из 008; механически — два роута. Удовлетворяет success-критерию «таб-карточка с вкладками».
- Login: email (`type=email`, autocomplete=email) + пароль (`.pw` с reveal-eye, autocomplete=current-password). CTA «Войти».
- Register: email + пароль (≥8, new-password) + Имя (`name`, req) + Никнейм (`nickname`, req, `^[A-Za-z0-9_-]{3,30}$`) + Телефон (opt) + Дата рождения (opt) + Уровень (`skillLevel`, **required** select). CTA «Зарегистрироваться». courtSide НЕ собирается при регистрации (это поле профиля).
- Поля/валидация/RU-сообщения = текущие v2.0 (зеркалят Zod/Better Auth). reveal-eye пароля — клиентский лист. Ошибки — `.error` (pop-keyframe). select-chevron через CSS-mask токеном (`--text-muted`→`--ring` на focus).

### Профиль (006 «Карточка + форма») — UI-03
- Верх — `.idcard` «player-pass»: `.id-avatar` (инициалы), имя `<h1>`, `@USER-NN` mono `--primary`, `.id-chip` Уровень (accent) + Сторона; ниже read-only контакт-`meta` (Email с `<span class="ro-tag">логин</span>`, Телефон с `скрыт от соперников`). Затем `.net-rule` и форма.
- Форма правит реальные v2.0-поля: Имя (req), Никнейм (req, hint «Виден соперникам…»), Сторона корта (seg left/right/either), Телефон (opt), Уровень (opt select), Дата рождения (opt, type=date). **Email — read-only** (логин), смена email — существующий v2.0-флоу Better Auth (не ломаем).
- Edit-toggle (`Редактировать` включает инпуты+seg; `Сохранить` disabled до диффа от `data-init`, per-field changed-dot; на сохранении форма re-locks) — клиентский лист поверх существующего Server Action. Server Action отправки не меняется.

### Список турниров (004 «Плотный список») — UI-04
- Плотный выровненный grid на десктопе (`.list-head`/`.trow`, фикс. колонки `1.7fr 1fr .9fr 1.1fr .9fr 118px 30px` — статус 118px и chevron 30px ФИКСИРОВАННЫЕ для выравнивания строк), на телефоне — тот же DOM реформится в карточку через `grid-template-areas` под `@container (max-width: 780px)`. НЕ скрывать поля (формат/уровень) на телефоне.
- Status-seam слева (`::before` 3px): `s-reg`→`--primary`, `s-prog`→`--badge-prog-fg`, `s-fin`→mix `--text-faint`. Поля строки/карточки: имя, badge статуса, fmt-tag + вид, уровень (lowercase), capacity «X/size» + `.progress`, цена («NNN ₽»/«бесплатно» `.price-free`), дата (mono), место. Page-head: eyebrow + `<h1>Турниры` + `.ph-count` «N из M».
- **Collapsed filters**: `.filterbar` = `.search` + кнопка «Фильтры» открывающая `.filter-panel` поповер (2×2 `<select>`: Статус/Формат/Уровень/Вид) + footer «Найдено N» + «Сбросить». На кнопке `.fcount` бейдж числа активных (non-`all`) фасетов; `.on` при открытом; закрытие по outside-click; `aria-expanded/-controls`.
- **Фильтрация — СЕРВЕРНАЯ** (ключевое решение, прямо по reference): Server Component читает searchParams и фильтрует Prisma-запрос (Статус/Формат/Уровень/Вид + поиск по названию/месту). Существующий v2.0 `status`-параметр (напр. `?status=finished`) должен продолжать работать. Клиентский лист — ТОЛЬКО открытие/закрытие поповера + outside-click + бейдж счётчика + сабмит фасетов в searchParams (form GET или навигация). Sketch-трюк `[hidden]` для скрытия строк на клиенте НЕ использовать.

### ЛК-дашборд (005 «Мои турниры») — UI-05
- Секционная колонка (≤760px): identity-header `.who` (avatar + display-имя + `.pill`-ряд `@USER-NN`/уровень/сторона; справа CTA «Профиль» ghost + «Найти турнир» primary), затем три статус-группы **Активные / Предстоящие / Завершённые**, каждая с `.sec-head` (eyebrow + count + hairline).
- Каждый турнир — `.tcard` (2-col) с **ролью игрока** («пара с **Имя**» + аватар партнёра / «Одиночный зачёт»|«Одиночная заявка»), badge статуса, format·вид·место, и состоянием-зависимым правым блоком+CTA: active → round-progress «3/7» + primary «К текущему раунду»; upcoming → ghost «Открыть»; finished → `.place` (medal + «N место») + ghost «Результаты». Левый accent-bar `::before`: active→`--primary`, upcoming→`--accent`, finished→`--text-faint`. Данные (турниры игрока, роли, прогресс раундов) — существующие v2.0-запросы. CTA ведут на существующие роуты.

### Claude's Discretion
- Точная декомпозиция на планы/волны (например: auth+profile в одной волне, list+dashboard в другой; или по экрану) — на усмотрение планировщика; экраны независимы (общий фундамент Phase 12), могут параллелиться.
- Гранулярность клиентских листьев и имена под-компонентов — на усмотрение, при условии 1:1 классов скетчей и серверной фильтрации/чтения.
- Точная реализация серверной фильтрации (где в Prisma where, как маппить RU-лейблы фасетов в значения) — на усмотрение, но существующий `status`-параметр не ломать.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 12 foundation)
- `src/app/globals.css` — Court токены (`:root` + `@theme`) + компонентный слой `@layer components` (`.card/.card-pad/.btn/.btn-primary/.btn-ghost/.field/.label/.input/.hint/.error/.badge(+reg/prog/fin)/.pill/.meta/.progress/.avatar/.empty` …) + `.cq { container-type: inline-size }` + Court body. ВСЕ имена классов 1:1 со скетчами — переносить разметку без переименований.
- `src/components/nav.tsx`, `tournament-status-badge.tsx`, `logout-button.tsx` — уже в Court (Phase 12).
- Шрифты: `--font-display` (Oswald) / `--font-body` (Inter) / `--font-mono` (JetBrains Mono), cyrillic, через next/font (Phase 12).

### Existing v2.0 screen files (restyle in place — НЕ менять логику)
- Auth: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`.
- Профиль: `src/app/(app)/profile/page.tsx`.
- Список: `src/app/(public)/tournaments/page.tsx` (Server Component; читает searchParams; уже поддерживает `status`-фильтр).
- Дашборд: `src/app/(app)/dashboard/page.tsx`.

### Established Patterns
- Next 16 App Router, route-группы `(auth)/(app)/(public)`. Server Components (чтение) + Server Actions (запись). Интерактивные листья — единственные `"use client"`.
- Tailwind 4 CSS-first (`@layer components`), без `tailwind.config.js`, без UI-библиотек.

### Integration Points
- Все 4 экрана потребляют `_base`-классы + токены из `globals.css` и оборачиваются в `.cq`.
- `@container`-брейкпоинты в `globals.css` (общие, напр. `.trow`/`.tcard`/`.filter-panel` reflow) ИЛИ в со-компонентных стилях — на усмотрение, но через container-queries, не media.
</code_context>

<specifics>
## Specific Ideas
- Reference-файлы дают точные HTML-структуры, CSS-паттерны и «What to Avoid» по каждому экрану — переносить дословно: `forms-and-auth.md` (008/006), `lists-and-filters.md` (004/005).
- Критично 1:1 классы/токены — Phase 12 уже их определил; имена не изобретать.
- Список: фикс. колонки (не `auto`) для выравнивания; фильтрация серверная; sketch `[hidden]`-трюк не переносить.
- Auth: courtSide не в регистрации; email read-only в профиле; не выбрасывать поле Никнейм.
</specifics>

<deferred>
## Deferred Ideas
- Страница турнира, создание турнира (007), регистрация пары (001), сетка (003), форматные страницы (009) → Phase 14.
- Главная `src/app/page.tsx` (HOME-01) — не в Phase 13 (не входит в UI-02..05; оформлена в v2.0 phase 10 на монохроме). Если на фоне Court-рестайла она будет визуально выбиваться — поднять как отдельную мелкую задачу/флаг, не расширяя Phase 13.
- Визуальный/браузерный UAT (десктоп + ≤375px) — в совместный визуальный UAT v3.0 после Phase 14 (паттерн проекта).
</deferred>
