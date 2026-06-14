# Phase 14: Страницы турниров - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss, autonomous mode — grey areas decided at Claude's discretion, grounded in the locked Court design contract + the v3.0 "restyle-only, preserve v2.0 behavior" constraint; data availability confirmed by codebase scout)

<domain>
## Phase Boundary

Перевести на Court четыре поверхности визуализации/ввода турниров, потребляя `_base`-слой и токены Phase 12: **страница турнира** (`(public)/tournaments/[id]`, programme-шелл UI-06), **форма создания** (`(app)/admin/tournaments/new`, условная по формату UI-07), **сетка плей-офф** (`bracket-view`, set-tally + games-on-hover, без счёта финала UI-08), **форматные страницы** (`round-robin-view` + `rotation-view`, расписание + таблицы UI-09).

**Источник истины:** skill `sketch-findings-diplom` — `references/tournament-pages.md` (002 detail, 003 bracket, 009 A круговой + B ротация) + `references/forms-and-auth.md` (007 create) + `sources/002/003/007/009/`. Переносить разметку/классы 1:1.

**НЕ входит:** экраны Phase 13 (auth/profile/list/dashboard) — готовы. Главная (HOME-01) — вне v3.0.
</domain>

<decisions>
## Implementation Decisions

### Общий подход (все поверхности)
- Чистый рестайл существующих v2.0-экранов/компонентов: переносим Court-разметку и `_base`-классы из `sources/NNN-*/index.html`, НЕ трогая Server Actions, бизнес-логику движков форматов, валидацию, ветвление по format/participantMode, renderEntry-гейт (admin+in_progress) и readOnly (`!isAdmin || finished`). v2.0-поведение сохраняется.
- Данные ПОДТВЕРЖДЕНЫ доступными (скаут): detail-хаб уже использует `getOptionalSession()` → `userId`/`isAdmin`; `RoundMatch.courtNumber` есть («Корт N»); `SetScore.gamesPair1/gamesPair2/setNumber` есть (set-tally + games-popover); `computeStandings` (derived) есть; чемпион — из финала bracket. Никаких НОВЫХ запросов/схемы не требуется (в отличие от Phase 13). Если где-то всплывёт мелкий read-gap — допустим READ-ONLY дочитывание по существующим моделям, без миграций/Server Actions/записи.
- Каждый экранный wrapper — `.cq` (утилита Phase 12); анонимные `@container` брейкпоинты (не `@media`). Никаких захардкоженных hex (только токены/`color-mix`).
- Намеренный горизонтальный скролл допустим ВНУТРИ своих контейнеров: `.bracket-scroll` (сетка) и `.standings-scroll` (широкие таблицы) — НЕ скроллить body страницы.

### Страница турнира — programme (002) — UI-06
- Единый editorial-столбец (≤720px), общий шелл для всех форматов (тело — bracket/standings — свапается, hero+РЕГЛАМЕНТ+СТАРТОВЫЙ ЛИСТ остаётся). Hero: eyebrow «Турнир · <Формат>» + status-badge (live-dot на reg/prog) + h1 + dot-separated lede (`&nbsp;` вокруг цены — flex trim gotcha; даты/цена в `.mono`).
- РЕГЛАМЕНТ — `.card.card-pad` + `.meta`/`.meta-row` (Размер/Формат/Состав/Уровень/Подсчёт/Взнос[/Дата/Место]); значение Формат — `.tip[tabindex=0][data-tip]` тултип (hover + `:focus-visible`). Уровень lowercase.
- СТАРТОВЫЙ ЛИСТ — `.plist` из `.pair` (нумерованный `.pair-seed` + два `.player` с `.avatar`+имя+`.player-sub` «сторона · уровень», `.vs`-разделитель). **«ВАША ПАРА»** — `.is-you` (доступно: сравнить `userId` с парой). Capacity: `.cap-head` + `.cap-count` («<b>N</b> / size пар») + `.progress` + `.empty` «Осталось N мест».
- CTA-блок `.cta-stack` (цена + «Участвовать парой») и admin-блок `.admin-box` (жеребьёвка) — рестайл существующих participate/start/finish/remove форм; Server Actions и гейты неизменны.
- Формы ввода счёта (`ScoreForm`/`RoundScoreForm`) и participate/start/finish/remove — рестайл презентации на `_base` form-примитивы (`.field/.input/.btn/.error`), Server Actions/валидация неизменны. renderEntry только admin+in_progress; readOnly как в v2.0.

### Форма создания (007) — UI-07
- Рестайл существующей `create-tournament-form` на секционную Court-форму (≤640px, fieldset-секции, `.net-rule` разделители). Формат-select драйвит условные поля. ПОЛНОСТЬЮ сохранить существующий Server Action + валидацию + free-form подсчёт (БЕЗ `setsPerMatch`/`gamesPerSet`/`targetPoints` в форме).
- Правила по формату (зеркалят v2.0 `createTournamentSchema`): playoff→select 4/8/16 + Тип selectable + Подсчёт selectable; round_robin→number min 3 + selectable; americano→number min 4 + Тип/Подсчёт **forced Одиночный/Очки (locked)** + Число раундов (optional); mexicano→number min 8 + locked + Число раундов (**required**). Размер-контрол свапает select↔number (только видимый несёт `name="size"`). seg-радио с `:has()` (значение сабмитится нативно). Token-chevron на select. Никаких новых полей.

### Сетка плей-офф (003) — UI-08
- Рестайл `bracket-view`: колонки раундов в `.bracket-scroll`; лейблы по depth-from-final (Финал/Полуфинал/Четвертьфинал/«1/8 финала»…); `.match` = два `.slot` (winner `.win` → `--winner-bg` + primary-бар + checkmark; TBD — italic faint). **Полные имена — НЕ обрезать** (`white-space: normal`).
- **SCORE: set-tally на пару** (стопка из 2 чисел справа, winner — `--primary`), выводится из `SetScore` (счёт сетов). **Счёт по геймам — в popover по hover(desktop)/tap(mobile)** (`.sd-pop`, `position:fixed`, одна `.sd-col` на сет, odd-tint). **БЕЗ счёта финала нигде**; champion-banner — только имя чемпиона (без счёта).
- **Size-toggle (4/8/16) НЕ переносим** — это был демо-контрол скетча; реальная сетка рендерит фактический размер турнира. Требование «выравнивание на 4/8/16» относится к корректной геометрии колонок/линий для реального размера, не к переключателю.
- Connector-elbows (бордер-линии, путь победителя `.live`) — желательны, но **деградируемы**: геометрия меряется JS (`getBoundingClientRect` + `document.fonts.ready` + resize re-measure; НЕ мерять во время `transform`-перехода). Если стабильная React-реализация выходит дорогой/хрупкой — допустимо упростить до статичных колонок без измеренных elbow-коннекторов (ядро UI-08: tally + games-popover + no-final-score + champion-banner + выравнивание — выполнимо и без них). Popover/tally/centering — клиентский лист.

### Форматные страницы (009 A+B) — UI-09
- Общий `.t-head` (eyebrow + `.badge-prog` live + h1 + `.meta-strip` + `.round-prog` «Раунд N из M») + `.net-rule` + `.matches`/`.mrow` + `.standings`.
- **A Круговой (`round-robin-view`):** «Матчи» по раундам (`.round-block`/`.round-label`); `.mrow` = `.court` («Корт N» — есть `courtNumber`) · `.matchup` (`.side.win`/`.lose`) · `.score` (losing `.dim`) либо `.await` «Ожидает счёта». «Турнирная таблица»: Место/Участник/Игр/Победы/Поражения/Очки/Разница; `.leader`/`.podium`; diff `.pos/.neg/.zero`.
- **B Американо/Мексикано (`rotation-view`):** «Текущие игры» (`.matches.live` + `.await` target-pills) + «Прошедшие игры» (реальные счета) + «Рейтинг игроков»: Место/Игрок/Сыграно/Победы/Очки/Разница, `.unit-cell` (avatar+имя). Транзитные пары по раундам. **БЕЗ cut-line** (чистый рейтинг, не плей-офф).
- Обе таблицы — в `.standings-wrap > .standings-scroll` (телефон скроллит таблицу, не страницу).

### Claude's Discretion
- Декомпозиция на планы/волны (detail+sub-forms — самый большой; bracket; format pages; create form могут идти как отдельные планы). Detail-страница и view-компоненты — общий хаб, осторожно с пересечением файлов (хаб vs компоненты).
- Гранулярность клиентских листьев (bracket popover/connectors, create-form conditional logic, score-form inputs) — на усмотрение, при 1:1 классах и без изменения Server Actions/логики.
- Где живёт screen-CSS (co-located `.css` на экран, как в Phase 13) — на усмотрение; не писать в `globals.css`.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 12 + 13)
- `globals.css` — Court токены + `_base`-слой + `.cq`. Имена классов 1:1 со скетчами.
- Phase 13 паттерн: co-located `.css` на экран (импорт `../screen.css`), `.cq` wrapper, клиентские листья только для интерактива.

### Existing v2.0 files (restyle in place — НЕ менять логику)
- Detail-хаб: `src/app/(public)/tournaments/[id]/page.tsx` (352 стр; `getOptionalSession`→userId/isAdmin; ветвление playoff→BracketView, round-based→RoundRobinView/RotationView; `computeStandings`; renderEntry=admin+in_progress; readOnly=!isAdmin||finished). Сабформы в той же папке: `participate-form.tsx`, `single`-вариант, `start-tournament-form.tsx`, `score-form.tsx`, `round-score-form.tsx`, `remove-registration-form.tsx`, `finish-tournament-form.tsx`.
- Сетка: `src/components/bracket-view.tsx` (118). Форматы: `src/components/round-robin-view.tsx` (108), `src/components/rotation-view.tsx` (149).
- Создание: `src/app/(app)/admin/tournaments/new/page.tsx` (27) + `create-tournament-form.tsx`.

### Data shapes (confirmed — no new backend needed)
- `RoundMatch.courtNumber: Int` (Корт N). `SetScore{ setNumber, gamesPair1, gamesPair2 }` (per-set games → tally + popover). `getOptionalSession()` → userId (is-you highlight). `computeStandings` derived. listBracket/listRounds/listTournamentPlayers/listTournamentPairs services exist.

### Integration Points
- Detail-хаб импортирует view-компоненты + сабформы; рестайл затрагивает и хаб, и компоненты — планировщику развести владение файлами по планам, чтобы избежать пересечений.
</code_context>

<specifics>
## Specific Ideas
- `tournament-pages.md` и `forms-and-auth.md` (007) дают точные HTML/CSS/«What to Avoid» — переносить дословно. Критичные «avoid»: mirrored per-set scores (нет — только tally+popover), обрезка имён в сетке (нет), счёт финала (нет), cut-line в ротации (нет), `@media` (только `@container`), скролл body для широких таблиц (нет — внутри `.standings-scroll`/`.bracket-scroll`), `&nbsp;` в lede/цене, hardcoded hex (нет).
- Set-tally выводится из SetScore (число выигранных сетов), счёт по геймам — в popover; финал — без счёта; champion-banner — имя.
- Size-toggle не переносим; connector-elbows деградируемы.

</specifics>

<deferred>
## Deferred Ideas
- Визуальный/браузерный UAT (десктоп + ≤375px + bracket на 4/8/16 + широкие таблицы) — в совместный визуальный UAT v3.0 ПОСЛЕ Phase 14 (т.е. финальный milestone-UAT). Покрывает также отложенные визуальные проверки Phase 12/13.
- Если connector-elbow геометрия окажется чрезмерно хрупкой — упрощённый вариант без измеренных коннекторов (зафиксировать в SUMMARY), полноценные коннекторы — потенциальная будущая полировка.
</deferred>
