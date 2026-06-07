# Phase 8: Ядро бэкенда (создание, регистрация, админ, ЛК) - Research

**Researched:** 2026-06-07
**Domain:** Server Actions + сервисы + Zod-валидация над Prisma 6 / Better Auth 1.6 (Next.js 16 App Router, SQLite)
**Confidence:** HIGH (Better Auth email-change API verified against installed v1.6.14 source AND official docs; all other findings grounded in existing codebase patterns)

## Summary

Фаза 8 — чисто серверный слой: расширение Zod-схем, доменных сервисов и Server Actions для пяти задач — format-зависимое создание турнира, level-matching при регистрации, одиночная регистрация (`TournamentPlayer`), админ-удаление регистраций + ручной финиш, и правка всех полей профиля включая ник и email. Никакого UI, никаких движков генерации/результатов (Фаза 9/11). Вся новая логика аддитивна: playoff-стек (`registerPair`/`generateBracket`/`recordResult`/авто-финиш) не трогается, гоняется как инвариант.

Главный (и единственный реально неизвестный) вопрос — смена email через Better Auth при ВЫКЛЮЧЕННОЙ email-верификации — **полностью разрешён**. Установленная версия `better-auth@1.6.14` имеет endpoint `/change-email` (`auth.api.changeEmail` / `authClient.changeEmail`), который при `user.changeEmail = { enabled: true, updateEmailWithoutVerification: true }` обновляет email НЕМЕДЛЕННО и без SMTP — но ТОЛЬКО когда `user.emailVerified !== true` (в этом приложении `emailVerified` дефолтит в `false`, верификация выключена → условие всегда истинно). Это подтверждено и исходником установленного пакета (`node_modules/better-auth/dist/api/routes/update-user.mjs:426,441`), и официальной докой. **Критический подводный камень:** при попытке сменить на УЖЕ занятый email endpoint молча возвращает `{status:true}` (анти-leak существования email) — email НЕ меняется, ошибки НЕТ. Поэтому уникальность email надо pre-проверять в action ДО вызова changeEmail и возвращать RU-ошибку, иначе игрок «успешно» отправит форму, а email останется старым.

**Primary recommendation:** Включить `user.changeEmail.{enabled:true, updateEmailWithoutVerification:true}` в `src/lib/auth.ts`; сменять email серверно через `auth.api.changeEmail({ body:{ newEmail }, headers })` после ручного pre-check уникальности (вернуть `email_taken` RU-ошибку при коллизии). Ник менять через прямой guarded `prisma.user.update` внутри той же транзакции профиля, ловя P2002 → RU «ник занят» (зеркало регистрации). Format-валидацию делать через `z.discriminatedUnion("format", ...)` НЕТ — формат+режим имеют перекрёстные правила (americano forces singles), поэтому `superRefine` на расширенном `createTournamentSchema` проще и ближе к текущему стилю. Singles-регистрация — точная калька `registerPair` транзакции на `TournamentPlayer`. Level-check — строгое равенство внутри обеих транзакций. Remove/finish — два новых admin-action поверх существующих `transitionTournament` и прямого delete с status-guard.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Format-зависимая валидация размера/режима | Validation (Zod) | API/Service (createTournament) | Чисто декларативные правила формы → zod superRefine; сервис лишь пишет проверенные поля |
| Level-matching при регистрации | API/Service (transaction) | — | Требует чтения tournament.level + skillLevel игроков из БД внутри транзакции; не выразимо в zod (нет данных формы) |
| Одиночная регистрация | API/Service (registerSingle) | Validation | Транзакционная целостность (count+insert), как registerPair |
| Admin remove регистрации | API/Service + Action | — | requireAdmin + status-guard + delete; server-only |
| Ручной финиш турнира | API/Service (transitionTournament) | Action | Переиспользует существующую forward-only машину |
| Смена ника | API/Service (profile update tx) | Validation | @@unique конфликт ловится на уровне БД (P2002) |
| Смена email | Better Auth (auth.api.changeEmail) | Action (pre-check uniqueness) | Email живёт под управлением Better Auth (Account/session cookie); НЕ править напрямую prisma — иначе session-cookie рассинхрон |
| Authz (requireUser/requireAdmin) | API/Service (auth-guards) | — | Session-cookie (Node runtime), never client |

## Standard Stack

Эта фаза НЕ добавляет зависимостей. Использует уже установленное.

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | 1.6.14 `[VERIFIED: node_modules/better-auth/package.json]` | Смена email (changeEmail), session/identity | Уже сконфигурирован (auth.ts); email-change встроен |
| @prisma/client | 6.19.3 `[VERIFIED: node_modules/@prisma/client/package.json]` | DB-доступ, транзакции, P2002 conflict | Уже стек проекта |
| zod | 4.4.3 `[VERIFIED: node_modules/zod/package.json]` | Валидация форм/FormData | Уже стек; superRefine для cross-field |
| next | 16.x (App Router) | Server Actions + revalidatePath | Уже стек |

### Supporting
Ничего нового. Переиспользуются: `requireUser`/`requireAdmin` (auth-guards.ts), `transitionTournament` (tournament-status.ts), `RegistrationError` (registration.ts), Prisma singleton (`@/lib/db`).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `auth.api.changeEmail` (server) | `authClient.changeEmail` (browser) | Client-вариант требует браузерного контекста — для USR-03 action бэкенд-слой, server `auth.api` точнее; client-форму подключит Фаза 11 |
| `superRefine` для format-правил | `z.discriminatedUnion("format",...)` | Discriminated union красивее для непересекающихся веток, но здесь правила перекрёстные (format ↔ participantMode принуждение, level всегда нужен) и поля общие → union раздувает дублирование. superRefine ближе к текущему `.refine` стилю |
| Прямой `prisma.user.update({email})` | `auth.api.changeEmail` | Прямой update НЕ обновит session-cookie (рассинхрон: cookie держит старый email до релогина) + обходит будущую verification-логику. Использовать НЕЛЬЗЯ для email |

**Installation:** Не требуется. Только правка `src/lib/auth.ts` (добавить `user.changeEmail` config — см. Code Examples).

## Package Legitimacy Audit

> Фаза не устанавливает внешних пакетов — все зависимости уже в проекте и проверены в Фазах 1–7. Аудит slopcheck не требуется (новых установок нет).

| Package | Registry | Disposition |
|---------|----------|-------------|
| better-auth@1.6.14 | npm (installed) | Approved (existing, in use since Phase 2) |
| @prisma/client@6.19.3 | npm (installed) | Approved (existing) |
| zod@4.4.3 | npm (installed) | Approved (existing) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          BROWSER (Phase 11 UI — out of scope here)
                                       │ FormData POST
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SERVER ACTION ("use server")  ── public HTTP endpoint, Node runtime       │
│                                                                           │
│  1. requireAdmin() | requireUser()   ← FIRST line, security boundary      │
│  2. zod parse (parseXForm)           ← input validation (REJECT early)    │
│  3. service(prisma, ...) in tx       ← business rules + integrity         │
│  4. revalidatePath(...)              ← cache purge                        │
│  5. return {ok} | {ok:false,error}   ← typed RU result                    │
└──────────────┬──────────────────────────────────────────┬───────────────┘
               │                                            │
   ┌───────────▼───────────┐                  ┌─────────────▼──────────────┐
   │  DOMAIN SERVICE (tx)   │                  │  Better Auth (email only)   │
   │  validation/*.ts rules │                  │  auth.api.changeEmail({     │
   │  prisma.$transaction:  │                  │    body:{newEmail},headers })│
   │   re-read status        │                 │  → updateEmailWithoutVerif. │
   │   level equality check  │                 │  → updates session cookie   │
   │   capacity count+insert │                 └─────────────┬──────────────┘
   │   throw RegistrationError│                              │
   └───────────┬─────────────┘                              │
               ▼                                            ▼
        ┌──────────────────────────  SQLite (Prisma)  ────────────────┐
        │ Tournament  Pair  TournamentPlayer  User(email,nickname @@unique)│
        └────────────────────────────────────────────────────────────────┘

  CREATE  ─► createTournament (admin)        ─► Tournament row (status="registration")
  REG pair─► registerPair + level check      ─► Pair  (count vs size)
  REG solo─► registerSingle + level check     ─► TournamentPlayer (count vs size)
  REMOVE  ─► removePair/removeParticipant     ─► delete (only status="registration")
  FINISH  ─► transitionTournament(in_prog→fin)─► Tournament.status
  PROFILE ─► updateProfile + nickname (tx) + changeEmail (BA) ─► User
```

### Recommended File Touch-Map (no new dirs)
```
src/lib/validation/
├── tournament.ts        # EXTEND createTournamentSchema (+format/mode/level/price/scoring/rounds/sets) + superRefine
├── profile.ts           # EXTEND profileSchema (+name/birthDate/nickname/email; skillLevel now required)
└── registration.ts      # ADD parseRegisterSingleForm (mirror parseRegisterPairForm)
src/lib/services/
├── tournament.ts        # EXTEND createTournament (write new fields)
├── registration.ts      # ADD registerSingle + inject level check into registerPair; +RegistrationError codes
├── tournament-status.ts # REUSE transitionTournament (no change) — finish wraps it
├── admin.ts (NEW)       # removePair / removeParticipant (status-guarded delete)
└── profile.ts           # EXTEND updateProfile (name/birthDate/nickname); email via auth.api in action
src/lib/auth.ts          # ADD user.changeEmail = {enabled, updateEmailWithoutVerification}
src/app/(app)/profile/actions.ts            # EXTEND updateProfileAction (nickname P2002 map + changeEmail)
src/app/(public)/tournaments/[id]/actions.ts # ADD participateSingleAction, removeRegistrationAction, finishTournamentAction
src/app/(app)/admin/tournaments/actions.ts   # EXTEND create action with new fields (admin)
```

### Pattern 1: Server Action shape (established — mirror exactly)
**What:** requireGuard → zod parse → service in `$transaction` → revalidatePath → typed `{ok}` result; `tournamentId`/`matchId` bound via `.bind()`, never from form; only typed `XError` messages surfaced, generic RU fallback otherwise.
**Source:** existing `src/app/(public)/tournaments/[id]/actions.ts` (participateAction, startTournamentAction).

### Pattern 2: Transactional integrity gate (registerPair → registerSingle)
**What:** ALL of {re-read status, level check, capacity count, duplicate check, insert} inside ONE `prisma.$transaction` so count+insert can't race.
**Source:** `src/lib/services/registration.ts:63-113`.

### Pattern 3: @@unique conflict → RU message (no pre-check for nickname)
**What:** Rely on DB `@@unique([nickname])`, catch Prisma P2002, map to RU. Mirror registration's `FAILED_TO_CREATE_USER` handling. Schema comment (User model, line 59-62) explicitly says: nickname is the ONLY unique create-time field besides email → P2002 ⇒ "ник занят".
**Source:** prisma/schema.prisma User `@@unique([nickname])`.

### Anti-Patterns to Avoid
- **Прямой `prisma.user.update({ email })` для смены email:** обходит Better Auth → session-cookie держит старый email до релогина (рассинхрон), и ломается при будущем включении верификации. Use `auth.api.changeEmail`.
- **Pre-check ника через findUnique перед update:** TOCTOU-гонка. Полагаться на @@unique + catch P2002 (как делает регистрация).
- **`participantMode` из формы не сверять с `tournament.participantMode`:** singles-action на pairs-турнире (и наоборот) должен отклоняться по DB-значению, не по форме.
- **Класть auth/role в Edge middleware:** проект явно Node-runtime (auth-guards.ts comment) — не трогать.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Смена email + sync сессии | Прямой prisma update + ручной cookie refresh | `auth.api.changeEmail({body:{newEmail},headers})` | BA сам обновляет session cookie (update-user.mjs:443) и инкапсулирует verification-логику |
| Уникальность ника/email | findUnique pre-check + ручной lock | DB `@@unique` + catch P2002 | Атомарно, без TOCTOU; уже паттерн регистрации |
| Status-машина финиша | Новый if/else по статусам | `transitionTournament(prisma,id,"in_progress","finished")` | Forward-only guard + DB-source-of-truth уже есть; идемпотентность через предварительную проверку статуса |
| Транзакционный счётчик мест | Отдельный count → потом insert | count+insert в одном `$transaction` | registerPair уже решает гонку (Pitfall 7) |
| Хеш пароля / identity | — | requireUser()/requireAdmin() | BA + guards уже есть |

**Key insight:** Email — единственное поле профиля, которым владеет Better Auth (а не доменный слой). Всё остальное (name/skillLevel/phone/birthDate/courtSide/nickname) — обычные prisma-колонки User, правятся в `updateProfile`. Email обязан идти через `auth.api.changeEmail`, потому что он связан с session cookie и (потенциально) Account/Verification.

## Common Pitfalls

### Pitfall 1: changeEmail молча "успешен" при занятом email (anti-enumeration)
**What goes wrong:** Игрок меняет email на уже существующий. `auth.api.changeEmail` возвращает `{status:true}` — НО email НЕ меняется. Игрок думает, что сменил.
**Why it happens:** update-user.mjs:433-437 — если `findUserByEmail(newEmail)` находит юзера, endpoint создаёт фейковый verification-token и возвращает `{status:true}` без апдейта, чтобы не раскрывать существование email (security feature).
**How to avoid:** В `updateProfileAction` ДО вызова `changeEmail` сделать `prisma.user.findUnique({where:{email:newEmail},select:{id:true}})`; если найден и это не текущий пользователь → вернуть `{ok:false, errors:{email:"Этот email уже используется"}}`. Тогда до changeEmail дойдут только свободные email. (Для оффлайн-демо leak-риск неактуален, корректность UX важнее.)
**Warning signs:** Форма «успешна», но email в БД старый.

### Pitfall 2: changeEmail требует ОБА флага + emailVerified=false
**What goes wrong:** `changeEmail.enabled:true` без `updateEmailWithoutVerification:true` → endpoint бросает 400 "Verification email isn't enabled" (update-user.mjs:429-432), т.к. ни один из трёх флоу недоступен без SMTP.
**Why it happens:** Три ветки: (a) `canUpdateWithoutVerification = emailVerified!==true && updateEmailWithoutVerification`; (b) `canSendConfirmation` (нужен verified email + SMTP); (c) `canSendVerification` (нужен SMTP). Без SMTP и без флага — все три false → throw.
**How to avoid:** `user: { changeEmail: { enabled: true, updateEmailWithoutVerification: true } }`. Работает, т.к. в этом приложении `emailVerified` дефолтит `false` (schema:22) и никогда не выставляется в true (верификация выключена).
**Warning signs:** 400 от changeEmail, лог "Verification email isn't enabled".

### Pitfall 3: changeEmail НЕ через `updateUser` — updateUser явно запрещает email
**What goes wrong:** Попытка сменить email через `auth.api.updateUser({email})`.
**Why it happens:** update-user.mjs:51 — `if (body.email) throw EMAIL_CAN_NOT_BE_UPDATED`. `updateUser` для name/image/additionalFields (nickname/phone/skillLevel) — НЕ для email.
**How to avoid:** Email → `changeEmail`. Остальные User-поля можно либо через `updateUser` (синхронит cookie), либо проще — прямой `prisma.user.update` в `updateProfile` (как сейчас). Рекомендация: ник/phone/skillLevel/name/birthDate править прямым prisma.update (текущий паттерн), email — единственное исключение через changeEmail.
**Warning signs:** 400 EMAIL_CAN_NOT_BE_UPDATED.

### Pitfall 4: nickname @@unique race
**What goes wrong:** Pre-check «ник свободен» → потом update → между ними другой занял.
**How to avoid:** Прямой `prisma.user.update({data:{nickname}})`, catch `e.code==="P2002"` → RU «Этот ник уже занят». Зеркало registration FAILED_TO_CREATE_USER.
**Warning signs:** Unhandled P2002 пробрасывается как 500.

### Pitfall 5: participantMode mismatch (action vs tournament)
**What goes wrong:** `participateSingleAction` вызван на pairs-турнире (или `participateAction` на singles).
**How to avoid:** В каждой транзакции после re-read статуса проверить `tournament.participantMode`: singles-путь требует `participantMode==="singles"`, pairs-путь — `"pairs"`. Иначе `RegistrationError("wrong_mode", "...")`. americano/mexicano всегда singles (валидация при создании это гарантирует на уровне Tournament-строки).
**Warning signs:** Pair создаётся для americano-турнира.

### Pitfall 6: level mismatch — для пары проверять ОБА игрока
**What goes wrong:** Проверить уровень только player1.
**How to avoid:** В registerPair-транзакции прочитать `skillLevel` обоих игроков + `tournament.level`; reject если `p1.skillLevel !== level || p2.skillLevel !== level`. Строгое равенство (D2/CONTEXT).
**Warning signs:** Пара с разным уровнем проходит.

### Pitfall 7: capacity для singles считается по TournamentPlayer, не Pair
**What goes wrong:** Скопировать `tx.pair.count` в registerSingle.
**How to avoid:** singles: `tx.tournamentPlayer.count({where:{tournamentId}}) >= tournament.size`. Семантика size для не-playoff = число участников (CONTEXT).
**Warning signs:** Singles-турнир переполняется или недозаполняется.

### Pitfall 8: ручной finish ломает playoff авто-финиш / не идемпотентен
**What goes wrong:** finishTournamentAction на уже-finished турнире кидает ошибку из transitionTournament (status mismatch).
**How to avoid:** Перед transition прочитать статус: если уже `"finished"` → no-op `{ok:true}`. Иначе `transitionTournament(prisma,id,"in_progress","finished")`. Playoff авто-финиш (result.ts) НЕ трогать — ручной финиш просто другой путь к тому же терминалу; для round-based это основной путь.
**Warning signs:** «Status changed: expected in_progress but DB has finished».

## Code Examples

### auth.ts — enable email change without verification
```typescript
// Source: official docs (better-auth.com/docs/concepts/users-accounts) +
//         installed source node_modules/better-auth/dist/api/routes/update-user.mjs:426,441
export const auth = betterAuth({
  // ...existing...
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: { /* existing phone/skillLevel/nickname */ },
    // NEW: позволяет сменить email БЕЗ SMTP, т.к. emailVerified всегда false в этом приложении.
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
  },
  plugins: [ /* admin(), nextCookies() */ ],
});
```

### updateProfileAction — nickname (P2002) + email (changeEmail) flow
```typescript
// Source: existing actions.ts pattern + better-auth changeEmail behavior
"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { updateProfile } from "@/lib/services/profile";
import { parseProfileForm } from "@/lib/validation/profile";

export async function updateProfileAction(_prev, formData: FormData) {
  const user = await requireUser();              // identity NEVER from form
  const parsed = parseProfileForm(formData);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const { email, ...profile } = parsed.data;     // email split out — BA owns it

  // 1) Domain fields incl. nickname — direct prisma, catch @@unique P2002.
  try {
    await updateProfile(prisma, user.id, profile); // name/skillLevel/phone/birthDate/courtSide/nickname
  } catch (e) {
    if (e?.code === "P2002") return { ok: false, errors: { nickname: "Этот ник уже занят" } };
    throw e;
  }

  // 2) Email — only if changed. Pre-check uniqueness (Pitfall 1), then changeEmail.
  if (email && email !== user.email) {
    const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (clash && clash.id !== user.id) return { ok: false, errors: { email: "Этот email уже используется" } };
    try {
      await auth.api.changeEmail({ body: { newEmail: email }, headers: await headers() });
    } catch {
      return { ok: false, errors: { email: "Не удалось сменить email" } };
    }
  }

  revalidatePath("/profile");
  return { ok: true };
}
```

### validation/tournament.ts — format-dependent size/mode via superRefine
```typescript
// Source: existing createTournamentSchema style + FORMATS.md §6 (D1) sizes
import { z } from "zod";
import { skillLevels } from "@/lib/validation/auth";

export const tournamentFormats = ["playoff", "round_robin", "americano", "mexicano"] as const;
export const participantModes = ["pairs", "singles"] as const;
export const scoringModes = ["sets", "points"] as const;
export const PLAYOFF_SIZES = [4, 8, 16] as const;
export const SIZE_CAP = 24; // soft cap D7

export const createTournamentSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно"),
  format: z.enum(tournamentFormats),
  participantMode: z.enum(participantModes),
  level: z.enum(skillLevels),
  size: z.coerce.number().int().positive(),
  price: z.coerce.number().int().min(0).optional(),
  scoringMode: z.enum(scoringModes),
  targetPoints: z.coerce.number().int().positive().optional(), // points-mode; server defaults 24
  totalRounds: z.coerce.number().int().positive().optional(),  // americano/mexicano
  setsPerMatch: z.coerce.number().int().min(1).optional(),     // sets-mode, no upper cap
  gamesPerSet: z.coerce.number().int().min(1).optional(),
  date: z.union([z.literal(""), z.coerce.date()]).optional()
        .transform((v) => (v === "" || v === undefined ? undefined : v)),
  location: z.string().trim().optional()
        .transform((v) => (v === "" || v === undefined ? undefined : v)),
}).superRefine((d, ctx) => {
  // size rules per format
  if (d.format === "playoff") {
    if (!(PLAYOFF_SIZES as readonly number[]).includes(d.size))
      ctx.addIssue({ code: "custom", path: ["size"], message: "Размер должен быть 4, 8 или 16" });
  } else if (d.format === "round_robin") {
    if (d.size < 3) ctx.addIssue({ code:"custom", path:["size"], message:"Минимум 3 участника" });
    if (d.size > SIZE_CAP) ctx.addIssue({ code:"custom", path:["size"], message:`Максимум ${SIZE_CAP}` });
  } else if (d.format === "americano") {
    if (d.size < 4) ctx.addIssue({ code:"custom", path:["size"], message:"Минимум 4 игрока" });
    if (d.size > SIZE_CAP) ctx.addIssue({ code:"custom", path:["size"], message:`Максимум ${SIZE_CAP}` });
  } else if (d.format === "mexicano") {
    if (d.size < 8) ctx.addIssue({ code:"custom", path:["size"], message:"Минимум 8 игроков" });
    if (d.size > SIZE_CAP) ctx.addIssue({ code:"custom", path:["size"], message:`Максимум ${SIZE_CAP}` });
  }
  // participantMode forcing (D1): americano/mexicano = singles only
  if ((d.format === "americano" || d.format === "mexicano") && d.participantMode !== "singles")
    ctx.addIssue({ code:"custom", path:["participantMode"], message:"Американо/Мексикано — только одиночная регистрация" });
  // scoringMode (D3): americano/mexicano default to points
  if ((d.format === "americano" || d.format === "mexicano") && d.scoringMode === "sets")
    ctx.addIssue({ code:"custom", path:["scoringMode"], message:"Для американо/мексикано используйте режим очков" });
  // points-mode needs targetPoints (or server defaults 24); sets-mode needs sets/games
  if (d.scoringMode === "points" && d.targetPoints !== undefined && d.targetPoints <= 0)
    ctx.addIssue({ code:"custom", path:["targetPoints"], message:"Целевые очки > 0" });
});
```

### registerSingle — mirror registerPair on TournamentPlayer
```typescript
// Source: existing registerPair (registration.ts:63-113) — same transactional gate
export async function registerSingle(
  prisma: PrismaClient,
  { tournamentId, userId }: { tournamentId: string; userId: string },
) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, size: true, level: true, participantMode: true },
    });
    if (t.status !== "registration") throw new RegistrationError("not_open", "Регистрация на турнир закрыта");
    if (t.participantMode !== "singles") throw new RegistrationError("wrong_mode", "На этот турнир регистрация только парой");

    const me = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { skillLevel: true } });
    if (me.skillLevel !== t.level) throw new RegistrationError("level_mismatch", "Уровень игрока не совпадает с уровнем турнира");

    const count = await tx.tournamentPlayer.count({ where: { tournamentId } });
    if (count >= t.size) throw new RegistrationError("tournament_full", "Турнир заполнен");

    const dup = await tx.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } }, select: { id: true },
    });
    if (dup) throw new RegistrationError("already_registered", "Вы уже зарегистрированы в этом турнире");

    return tx.tournamentPlayer.create({ data: { tournamentId, userId }, select: { id: true, tournamentId: true, userId: true, createdAt: true } });
  });
}
```

### Level check injection into registerPair (REG-05)
```typescript
// Inside existing registerPair $transaction, after status re-read, before/with capacity:
const t = await tx.tournament.findUniqueOrThrow({
  where: { id: tournamentId },
  select: { id: true, status: true, size: true, level: true, participantMode: true }, // +level +participantMode
});
if (t.participantMode !== "pairs") throw new RegistrationError("wrong_mode", "На этот турнир регистрация только одиночная");
// ...self/capacity/dup as before...
const players = await tx.user.findMany({ where: { id: { in: [player1Id, player2Id] } }, select: { id: true, skillLevel: true } });
if (players.some((p) => p.skillLevel !== t.level))
  throw new RegistrationError("level_mismatch", "Уровень игрока не совпадает с уровнем турнира");
```

### Admin remove + finish actions
```typescript
// removeRegistrationAction — admin, only during registration
export async function removeRegistrationAction(tournamentId: string, kind: "pair"|"player", id: string, _prev, _fd) {
  await requireAdmin();
  await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { status: true } });
    if (t.status !== "registration") throw new Error("not_open"); // map → RU in catch
    if (kind === "pair") await tx.pair.delete({ where: { id } });
    else await tx.tournamentPlayer.delete({ where: { id } });
  });
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true };
}

// finishTournamentAction — admin, idempotent
export async function finishTournamentAction(tournamentId: string, _prev, _fd) {
  await requireAdmin();
  const t = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { status: true } });
  if (t.status === "finished") return { ok: true };           // idempotent no-op
  await transitionTournament(prisma, tournamentId, "in_progress", "finished");
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CLAUDE.md TL;DR: "hand-rolled cookie session, NOT Auth.js/Lucia" | Project actually uses **Better Auth ^1.6** (Constraints + installed code) | Phase 2 | Используем Better Auth API (changeEmail) — TL;DR-таблица в CLAUDE.md устарела относительно реально выбранного стека; Constraints-секция авторитетна |
| `createTournamentSchema` size ∈ {4,8,16} (.refine) | format-зависимый size (superRefine) | Phase 8 (this) | playoff сохраняет {4,8,16}; др. форматы — свободный N с cap |
| `profileSchema`: только courtSide/phone/skillLevel | +name/birthDate/nickname/email; skillLevel required | Phase 8 (this) | Полная правка профиля (USR-03) |

**Deprecated/outdated:**
- CLAUDE.md `## TL;DR Recommendations` строка про auth (hand-rolled / bcryptjs / iron-session) — НЕ отражает реальность проекта. Реальный стек: Better Auth 1.6 + scrypt (BA-default) + session-cookie. При планировании опираться на Constraints-секцию CLAUDE.md и установленный код, не на TL;DR.

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Next.js 16 (TS, App Router) — Server Components (чтение) + Server Actions (запись); Prisma 6.x (≥6.2, installed 6.19.3); SQLite. **Directive.**
- **Auth:** Better Auth `^1.6` (installed 1.6.14) — email+password, `admin()` plugin, Prisma-адаптер, SQLite, **Node runtime**; **email-верификация ВЫКЛЮЧЕНА** (offline-demo). **Directive — определяет changeEmail-флоу.**
- **Validation:** Zod 4 (installed 4.4.3). **Directive.**
- **No new deps without asking** (Developer Profile: Vendor Choices). Эта фаза не вводит новых — OK.
- **No Prisma enum** (SQLite) — String + zod union (Pitfall 9, established). **Directive.**
- **Follow existing patterns; check codebase for reusable fns before writing new** (Vendor Choices). registerPair/transitionTournament/auth-guards переиспользуются.
- **Scope discipline:** диплом, делать просто; не добавлять фичи/валидации/рефактор сверх запроса (Frustrations). НЕ трогать playoff-стек.
- **GSD enforcement:** изменения только через GSD-команды.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `emailVerified` остаётся `false` для всех юзеров (верификация выключена, никогда не выставляется true) | changeEmail flow | Если где-то выставляется true → `updateEmailWithoutVerification` перестанет срабатывать, changeEmail потребует SMTP и упадёт. Проверено: schema default false, нет sendVerificationEmail в auth.ts — риск низкий |
| A2 | SIZE_CAP=24 (soft) приемлем для round_robin/americano/mexicano | format validation | Чисто продуктовое; FORMATS.md D7 рекомендует ≤24. Низкий риск |
| A3 | Для round_robin singles min size — взять ≥3 как у pairs (FORMATS.md §1 «практ. 3-4», pairs/singles общий путь) | format validation | RR §1 говорит «мин 2 вырожденно, практ 3-4»; взял ≥3. Низкий риск, продуктовое |
| A4 | RR в points-режиме: запрет равных очков — НЕ в scope этой фазы (это валидация РЕЗУЛЬТАТА, Фаза 9 SCORE-01) | scope | D2 касается ввода результата (Фаза 9), не создания/регистрации. Здесь не реализуем |
| A5 | Прямой prisma.update для name/skillLevel/phone/birthDate/courtSide/nickname (НЕ через auth.api.updateUser) приемлем | profile update | updateUser синхронит session cookie для этих полей; прямой update — нет, но эти поля не в cookie-критичном пути (display-only). Текущий updateProfile уже так делает. Низкий риск |

## Open Questions

1. **birthDate во вводе профиля — формат FormData**
   - Что знаем: schema поле `birthDate DateTime?`; форма пришлёт строку.
   - Что неясно: точный парсинг (date-input → ISO). Рекомендация: zod `z.union([z.literal(""), z.coerce.date()]).optional().transform(...)` как у `date` в createTournamentSchema (тот же приём).
2. **Удаление через kind+id vs два отдельных action**
   - Что знаем: ADMN-01 удаляет Pair ИЛИ TournamentPlayer.
   - Рекомендация: один `removeRegistrationAction(kind,id)` (меньше дублирования) ИЛИ два `removePairAction`/`removeParticipantAction` для типобезопасности `.bind()`. План решит; оба валидны. Склоняюсь к двум — чище `.bind()` без дискриминатора в форме.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-auth | changeEmail | ✓ | 1.6.14 | — |
| @prisma/client | все сервисы | ✓ | 6.19.3 | — |
| zod | валидация | ✓ | 4.4.3 | — |
| SQLite (dev.db) | все транзакции | ✓ | file:./dev.db | — |
| tsx | прогон *.test.ts | ✓ (used Phase 7) | — | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

> `workflow.nyquist_validation: false` в config.json → секция Validation Architecture опущена (per instructions). Тестирование — в стиле существующих `*.test.ts` (см. ниже, Security/Pitfalls covered by tests).

Существующая тест-инфраструктура (для справки планировщику): 7 файлов `*.test.ts` гоняются через `tsx` (bracket/registration/tournament-status/result/profile/registration-validation/tournament-validation). Новые правила Фазы 8 покрываются в том же стиле: format-валидация (tournament-validation.test.ts EXTEND), level-mismatch + registerSingle + wrong_mode (registration.test.ts EXTEND), remove + idempotent finish (новый admin/tournament-status тест), profile nickname-conflict + email (profile.test.ts EXTEND). Все существующие 163 assertions гонять как инвариант (playoff не сломан).

## Security Domain

> `security_enforcement: true`, ASVS level 1, block_on: high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session cookie; password = BA scrypt (Account table). Не трогаем в этой фазе |
| V3 Session Management | yes | `changeEmail` обновляет session cookie (update-user.mjs:443) — НЕ править email напрямую (рассинхрон) |
| V4 Access Control | **yes (центр фазы)** | `requireAdmin()` первой строкой для create/remove/finish; `requireUser()` для register/profile; роль из session, НЕ из клиента (auth-guards.ts). userId/identity всегда из guard, НЕ из формы |
| V5 Input Validation | **yes** | Zod на всех action-входах; tournamentId/matchId/ids через `.bind()`, не из тела; size/format/level — server-side superRefine (клиент cosmetic) |
| V6 Cryptography | no | Никакой собственной крипты; пароль/хеши — Better Auth |

### Known Threat Patterns for Next.js Server Actions + Better Auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Прямой POST в admin-action минуя UI | Elevation of Privilege | `requireAdmin()` FIRST line — throw до любой работы (existing pattern) |
| Подмена userId/role/tournamentId через форму | Spoofing/Tampering | identity из `requireUser()`; ids через `.bind()`; status/level/mode re-read из DB |
| Email enumeration через changeEmail | Information Disclosure | BA уже маскирует (silent {status:true}); для демо — pre-check uniqueness ради UX (Pitfall 1) |
| Удаление регистрации после старта турнира | Tampering | status-guard `=== "registration"` в транзакции remove (ADMN-01) |
| Регистрация на чужой уровень / в чужом режиме | Business-logic abuse | level strict-equality + participantMode re-check внутри транзакции |
| Raw Prisma error → клиент | Information Disclosure | Только типизированные RU-сообщения (RegistrationError); generic fallback иначе (existing WR-02) |

## Sources

### Primary (HIGH confidence)
- **Installed source** `node_modules/better-auth/dist/api/routes/update-user.mjs` (v1.6.14) — `changeEmail` (lines 377-495): `canUpdateWithoutVerification = emailVerified!==true && updateEmailWithoutVerification` (426), direct update + session-cookie refresh (441-463), silent success on existing email (433-437), `updateUser` rejects email (51). **Authoritative for exact installed behavior.**
- **Installed type** `node_modules/@better-auth/core/dist/types/init-options.d.mts:690-712` — `user.changeEmail = { enabled, sendChangeEmailConfirmation?, updateEmailWithoutVerification? }`.
- Codebase: `src/lib/services/registration.ts`, `tournament.ts`, `tournament-status.ts`, `profile.ts`, `src/lib/validation/*.ts`, `src/lib/auth.ts`, `auth-guards.ts`, `src/app/(public)/tournaments/[id]/actions.ts`, `src/app/(app)/profile/actions.ts`, `prisma/schema.prisma` — established patterns.
- `.planning/research/FORMATS.md` (§5, §6 D1/D3/D6/D7) — size/mode rules per format.
- `.planning/phases/08-backend-core/08-CONTEXT.md` — locked decisions (D2 strict-equality, singles path, remove/finish).

### Secondary (MEDIUM confidence — cross-verifies primary)
- https://better-auth.com/docs/concepts/users-accounts — `updateEmailWithoutVerification` documented behavior (matches installed source exactly): updates immediately only when current email NOT verified; default false → wait for verification.
- https://better-auth.com/docs/reference/options — user.changeEmail options.
- https://github.com/better-auth/better-auth/issues/3424 — `auth.api.changeEmail` updates immediately when unverified (confirms server-API path).

### Tertiary (LOW confidence)
- (none — all critical claims verified against installed source + official docs)

## Metadata

**Confidence breakdown:**
- changeEmail / nickname API (the main unknown): **HIGH** — verified against installed v1.6.14 source AND official docs AND GitHub issue; behavior is deterministic given this app's config (emailVerified=false).
- Format validation: **HIGH** — sizes from FORMATS.md (high-confidence research) + standard zod superRefine; matches existing schema style.
- Singles registration / level matching: **HIGH** — direct mirror of verified registerPair transaction pattern.
- Admin remove/finish: **HIGH** — reuses existing transitionTournament + standard status-guarded delete.
- Pitfalls: **HIGH** — derived from installed source line-by-line + existing codebase invariants.

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable — pinned installed versions; Better Auth 1.6.x API stable)
