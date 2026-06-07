# Phase 10: UX-фундамент (локализация, тема, адаптив, главная, шапка) - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — фронтенд-решения по требованиям 1.4/1.5/1.6/4/5 + конвенции Tailwind/CLAUDE.md; per [[padel-autonomous-no-questions]] без вопросов.

<domain>
## Phase Boundary

Слой 3 (фронтенд/UX), часть 1 из 2 — ФУНДАМЕНТ. Весь сайт на русском, в принудительной тёмной теме, адаптивный; главная = список открытых турниров; шапка с названием клуба, логотипом, кнопкой «Прошедшие турниры» и входом в ЛК.

**В scope (SITE-01, SITE-02, SITE-03, HOME-01, HDR-01):** глобальная локализация, тема, адаптив, главная, шапка/навигация.
**НЕ в scope:** формы создания/регистрации/ЛК, визуализация форматов, ввод счёта, страница истории прошедших с per-format детализацией — Фаза 11 (FORM/SCORE-02/VIS). Бэкенд готов (Фазы 8–9).
</domain>

<decisions>
## Implementation Decisions

### Тёмная тема (SITE-02)
- Принудительная тёмная тема (не OS-driven). В `src/app/globals.css`: задать `:root` сразу тёмными значениями (`--background:#0a0a0a`, `--foreground:#ededed` или близкие), УБРАТЬ/нейтрализовать `@media (prefers-color-scheme: dark)` (чтобы светлая ОС не делала сайт светлым). `<html>` — добавить класс `dark` (если используется) и тёмный фон по умолчанию.
- Починить захардкоженные СВЕТЛЫЕ Tailwind-палитры в статус-бейджах/алертах (`bg-green-100/text-green-800`, `bg-red-100`, `bg-amber-100`, `bg-gray-200` и т.п. в `tournament-status-badge.tsx` и формах) → тёмные эквиваленты (напр. `bg-green-900/30 text-green-300` / `border` подход) с достаточным контрастом. Семантические `bg-foreground/text-background` уже адаптируются — проверить.
- Без библиотек тем / toggle — тема одна (тёмная). Простота (CLAUDE.md).

### Русская локализация (SITE-01)
- `<html lang="en">` → `lang="ru"`. Перевести ВСЕ английские строки UI: home/page.tsx, login (page+form), register-form лейблы (Email/Password/Name/Phone/Skill level → Почта/Пароль/Имя (ФИО)/Телефон/Уровень), dashboard («Welcome» → «Добро пожаловать»), profile (page+form: Court side/Phone/Skill level/Save → Сторона корта/Телефон/Уровень/Сохранить), nav (Log in/Register/Log out → Войти/Регистрация/Выйти), metadata title/description.
- Уровни игры: выводить через `skillLevelLabels` (RU-map из Фазы 7) везде, где сейчас сырые латинские значения (register select, profile select).
- Без i18n-библиотеки (один язык) — строки прямо в JSX/константах. Простота.

### Адаптив (SITE-03)
- Tailwind utility-first, mobile-first. Проверить ключевые экраны (главная, список/детали турнира, формы, шапка) на mobile (узкая ширина) и desktop. Добавить недостающие breakpoints (sm:/md:) где вёрстка ломается; шапка — компактный/переносной layout на мобильном. Без горизонтального скролла ключевых блоков (сетка может скроллиться — это ок).

### Главная (HOME-01)
- `src/app/page.tsx`: вместо статичного splash — Server Component, читает открытые для регистрации турниры (`listTournaments` с фильтром `status='registration'` ИЛИ новый запрос) и рендерит список карточек (название/формат/уровень/дата/N из size) со ссылкой на `/tournaments/[id]`. Пусто → понятный пустой-стейт. RU + тёмная тема + адаптив.

### Шапка (HDR-01)
- `src/components/nav.tsx`: слева — название клуба + логотип (логотип = простой SVG/текстовый placeholder в `public/` или инлайн; БЕЗ внешних ассетов). Название клуба — константа `CLUB_NAME` (напр. «Падел Клуб», легко переименовать; можно из env с дефолтом). Справа: «Турниры», «Прошедшие турниры» (ссылка на завершённые — фильтр `status='finished'`; полноценная per-format история — Фаза 11 VIS-02, здесь достаточно ссылки на отфильтрованный список), вход в ЛК (ссылка на `/profile` для залогиненных — сейчас её НЕТ), имя пользователя, «Выйти»; для гостей — «Войти»/«Регистрация». Всё RU. Адаптив (мобильное меню — простое; без тяжёлых компонентов).

### Claude's Discretion
- Точные тёмные оттенки/контраст бейджей, конкретный placeholder-логотип (SVG/инициалы), формулировки RU-строк, структура карточек главной, мобильное поведение шапки (burger vs wrap) — на усмотрение исполнителя, следуя Tailwind 4 + существующим компонентам. Клубное имя — placeholder, помечен как переименуемый.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/globals.css` (тема — :root + prefers-color-scheme media query, семантические --background/--foreground + @theme color-* mapping).
- `src/app/layout.tsx` (`<html lang="en">`, Nav + children, metadata).
- `src/components/nav.tsx` (server component, getOptionalSession; ссылки Турниры/Создать турнир (admin)/Log in/Register/имя/Log out — смешанный RU/EN, НЕТ ссылки на /profile).
- `src/components/tournament-status-badge.tsx` (захардкоженные светлые палитры — починить).
- `src/components/logout-button.tsx` (LogoutButton client leaf).
- `src/app/page.tsx` (текущий статичный splash — заменить).
- `src/lib/services/tournament.ts` (`listTournaments` — добавить/использовать фильтр по статусу).
- `src/lib/validation/auth.ts` (`skillLevelLabels` RU-map — использовать для уровней).
- `src/app/(public)/tournaments/page.tsx` (список всех турниров — образец карточек/рендера; источник для фильтров open/finished).

### Established Patterns
- App Router Server Components для чтения; Tailwind 4 (CSS-first, `@theme`), без config-файла, без UI-kit (CLAUDE.md constraint).
- Семантические цвета через CSS-переменные; бейджи — единственное место с захардкоженной светлой палитрой.
- Nav — server component, читает сессию.

### Integration Points
- Главная и шапка ссылаются на существующие роуты (/tournaments, /tournaments/[id], /profile, /login, /register).
- skillLevelLabels (Фаза 7) — единая точка RU-подписей уровней.
- Карточки турнира показывают новые поля (format/level/price) из Фаз 7–8 — отрисовать их RU-лейблами (формат: playoff→«Олимпийская», round_robin→«Круговой», americano→«Американо», mexicano→«Мексикано»; добавить format-label map по аналогии со skillLevelLabels).
- Фаза 11 строит формы и per-format визуализацию поверх этого фундамента.
</code_context>

<specifics>
## Specific Ideas
- Добавить `formatLabels` (RU-map форматов) и `tournamentKindLabels` (одиночный/парный) по аналогии со `skillLevelLabels` — переиспользуются в Фазе 11.
- Не ломать существующие защищённые роуты/гварды. Изменения — презентационные + один новый запрос (open/finished фильтр).
- Минимум: НЕ вводить i18n-библиотеку, NEXT темы-библиотеку, UI-kit — прямые строки + Tailwind (CLAUDE.md: простота, без новых зависимостей без спроса).
- Тесты: проект тестирует сервисы (tsx); UI-проверка — сборка (`next build`)/typecheck зелёные + ручная (human-verify в конце фазы). Если добавляется запрос-фильтр в tournament.ts — покрыть юнит-тестом.
</specifics>

<deferred>
## Deferred Ideas
- Формы создания/регистрации/ЛК, селектор режима подсчёта, ввод результата по режиму — Фаза 11 (FORM-01/02/03, SCORE-02).
- Per-format визуализация (bracket/таблица RR/standings) + панели текущие/прошедшие игры — Фаза 11 (VIS-01).
- Полноценная страница прошедших турниров с историей по формату — Фаза 11 (VIS-02); здесь — только ссылка/фильтр.
</deferred>
