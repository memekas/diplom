# Листинг исходного кода ключевых компонентов системы

В приложении приведён не весь код проекта, а только ключевые, наиболее показательные фрагменты — отдельные функции и модели, раскрывающие архитектуру и доменную логику системы: модель данных, создание и регистрацию на турнир, генерацию турнирной структуры, подсчёт результата с продвижением и расчёт турнирной таблицы. Полные исходные тексты остальных модулей (другие форматы, серверные действия, валидация, интерфейс, тесты) в листинг не вынесены.

> **Стек:** Next.js 16 (App Router, TypeScript) — Server Components для чтения и Server Actions для записи; Prisma 6 + SQLite; Zod 4; Better Auth 1.6.
> Каждый фрагмент снабжён путём к файлу и кратким пояснением.

## Содержание

1. Модель данных (схема БД)
2. Создание турнира
3. Регистрация участников
4. Проведение турнира: диспетчеризация форматов
5. Проведение турнира: генерация олимпийской сетки (playoff)
6. Проведение турнира: ротация (американо)
7. Подсчёт результата и продвижение (playoff)
8. Расчёт турнирной таблицы (standings)

---

## 1. Модель данных (схема БД)

Декларативная схема Prisma (SQLite). Показаны доменные модели: `Tournament` с конфигурацией всех четырёх форматов; playoff-ветка (`Pair`, `Match`, `SetScore`) с самосвязью `Match → nextMatch` для дерева сетки; round-based ветка (`TournamentPlayer`, `Round`, `RoundMatch`, `PlayerMatchScore`). Уникальные ограничения работают как защита целостности (анти-дубликат регистрации, generate-once для сетки), каскады `onDelete` — как политика удаления. Auth-таблицы (User/Session/Account/Verification), генерируемые Better Auth, опущены.

### `prisma/schema.prisma`

_Доменные модели: турнир, playoff-ветка (пары/матчи/сеты), round-based ветка (игроки/раунды/очки)._

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Tournament {
  id           String    @id @default(cuid())
  name         String
  size         Int // 4 | 8 | 16
  status       String    @default("registration")
  date         DateTime?
  location     String?
  // Конфигурация форматов (поля аддитивны)
  format          String  @default("playoff")
  participantMode String  @default("pairs")
  level           String  @default("intermediate")
  price           Int?    // стоимость участия, ₽; null = бесплатно
  scoringMode     String  @default("sets")
  totalRounds     Int?    // раунды: только mexicano
  createdAt    DateTime  @default(now())
  pairs        Pair[]
  matches      Match[]
  tournamentPlayers TournamentPlayer[]
  rounds            Round[]

  @@map("tournament")
}

model Pair {
  id           String     @id @default(cuid())
  tournamentId String
  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  player1Id    String
  player1      User       @relation("PairPlayer1", fields: [player1Id], references: [id])
  player2Id    String
  player2      User       @relation("PairPlayer2", fields: [player2Id], references: [id])
  seed         Int? // посев 1..size (при генерации сетки)
  createdAt    DateTime   @default(now())
  matchesAsA   Match[]    @relation("MatchPairA")
  matchesAsB   Match[]    @relation("MatchPairB")
  matchesWon   Match[]    @relation("MatchWinner")

  @@unique([tournamentId, player1Id])
  @@unique([tournamentId, player2Id])
  @@map("pair")
}

model Match {
  id            String     @id @default(cuid())
  tournamentId  String
  tournament    Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  round         Int // 1 = первый раунд, max = финал
  position      Int // индекс в раунде (с 0)
  pairAId       String?
  pairA         Pair?      @relation("MatchPairA", fields: [pairAId], references: [id])
  pairBId       String?
  pairB         Pair?      @relation("MatchPairB", fields: [pairBId], references: [id])
  winnerId      String? // при продвижении победителя
  winner        Pair?      @relation("MatchWinner", fields: [winnerId], references: [id])
  // кэш выигранных сетов (для отображения)
  setsWonA      Int?
  setsWonB      Int?
  setScores     SetScore[]
  // победитель → слот родителя nextMatch (у финала null)
  nextMatchId   String?
  nextMatch     Match?     @relation("Bracket", fields: [nextMatchId], references: [id])
  feederMatches Match[]    @relation("Bracket")
  nextSlot      String? // "A" | "B"

  // не более 1 матча на (раунд, позицию)
  @@unique([tournamentId, round, position])
  @@index([tournamentId, round])
  @@map("match")
}

model SetScore {
  id         String @id @default(cuid())
  matchId    String
  match      Match  @relation(fields: [matchId], references: [id], onDelete: Cascade)
  setNumber  Int
  gamesPair1 Int
  gamesPair2 Int

  @@unique([matchId, setNumber])
  @@map("set_score")
}

model TournamentPlayer {
  id           String     @id @default(cuid())
  tournamentId String
  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  userId       String
  user         User       @relation("TournamentPlayerUser", fields: [userId], references: [id])
  createdAt    DateTime   @default(now())

  @@unique([tournamentId, userId])
  @@index([tournamentId])
  @@map("tournament_player")
}

model Round {
  id           String       @id @default(cuid())
  tournamentId String
  tournament   Tournament   @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  roundNumber  Int
  status       String       @default("pending")
  createdAt    DateTime     @default(now())
  matches      RoundMatch[]

  @@unique([tournamentId, roundNumber])
  @@map("round")
}

model RoundMatch {
  id           String  @id @default(cuid())
  roundId      String
  round        Round   @relation(fields: [roundId], references: [id], onDelete: Cascade)
  courtNumber  Int
  teamA1Id     String?
  teamA1       User?   @relation("RMTeamA1", fields: [teamA1Id], references: [id])
  teamA2Id     String?
  teamA2       User?   @relation("RMTeamA2", fields: [teamA2Id], references: [id])
  teamB1Id     String?
  teamB1       User?   @relation("RMTeamB1", fields: [teamB1Id], references: [id])
  teamB2Id     String?
  teamB2       User?   @relation("RMTeamB2", fields: [teamB2Id], references: [id])
  pointsA      Int?    // очки команды A (null до записи)
  pointsB      Int?    // очки команды B (null до записи)
  playerScores PlayerMatchScore[]

  @@index([roundId])
  @@map("round_match")
}

model PlayerMatchScore {
  id            String     @id @default(cuid())
  roundMatchId  String
  roundMatch    RoundMatch @relation(fields: [roundMatchId], references: [id], onDelete: Cascade)
  userId        String
  user          User       @relation("PlayerMatchScoreUser", fields: [userId], references: [id])
  teamSlot      String     // "A" | "B"
  pointsFor     Int
  pointsAgainst Int

  @@unique([roundMatchId, userId])
  @@index([userId])
  @@map("player_match_score")
}
```

## 2. Создание турнира

Каноничный путь записи: Zod-схема валидирует форму с format-зависимыми правилами (`superRefine`: playoff — только 4/8/16; американо/мексикано — только одиночная регистрация и режим очков), а сервис создаёт турнир, **жёстко** проставляя статус `registration` на сервере (никогда не из формы).

### `src/lib/validation/tournament.ts`

_createTournamentSchema — кросс-полевые правила форматов (Zod 4 superRefine)._

```typescript
export const createTournamentSchema = z
  .object({
    name: z.string().trim().min(1, "Название обязательно"),
    format: z.enum(tournamentFormats),
    participantMode: z.enum(participantModes),
    level: z.enum(skillLevels),
    size: z.coerce.number().int().positive(),
    price: z.coerce.number().int().min(0).optional(),
    scoringMode: z.enum(scoringModes),
    totalRounds: z.coerce.number().int().positive().optional(), // раунды: только mexicano
    // дата необязательна (пусто → undefined)
    date: z
      .union([z.literal(""), z.coerce.date()])
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : v)),
    // место необязательно (trim, пусто → undefined)
    location: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : v)),
  })
  .superRefine((d, ctx) => {
    // правила размера по формату
    if (d.format === "playoff") {
      if (!(PLAYOFF_SIZES as readonly number[]).includes(d.size))
        ctx.addIssue({ code: "custom", path: ["size"], message: "Размер должен быть 4, 8 или 16" });
    } else if (d.format === "round_robin") {
      if (d.size < 3) ctx.addIssue({ code: "custom", path: ["size"], message: "Минимум 3 участника" });
      if (d.size > SIZE_CAP) ctx.addIssue({ code: "custom", path: ["size"], message: `Максимум ${SIZE_CAP}` });
    } else if (d.format === "americano") {
      if (d.size < 4) ctx.addIssue({ code: "custom", path: ["size"], message: "Минимум 4 игрока" });
      if (d.size > SIZE_CAP) ctx.addIssue({ code: "custom", path: ["size"], message: `Максимум ${SIZE_CAP}` });
    } else if (d.format === "mexicano") {
      if (d.size < 8) ctx.addIssue({ code: "custom", path: ["size"], message: "Минимум 8 игроков" });
      if (d.size > SIZE_CAP) ctx.addIssue({ code: "custom", path: ["size"], message: `Максимум ${SIZE_CAP}` });
    }
    // американо/мексикано — только singles
    if ((d.format === "americano" || d.format === "mexicano") && d.participantMode !== "singles")
      ctx.addIssue({
        code: "custom",
        path: ["participantMode"],
        message: "Американо/Мексикано — только одиночная регистрация",
      });
    // американо/мексикано — режим очков
    if ((d.format === "americano" || d.format === "mexicano") && d.scoringMode === "sets")
      ctx.addIssue({
        code: "custom",
        path: ["scoringMode"],
        message: "Для американо/мексикано используйте режим очков",
      });
    // mexicano материализует раунды по одному;
    // без totalRounds не завершится → поле обязательно
    if (d.format === "mexicano" && d.totalRounds == null)
      ctx.addIssue({ code: "custom", path: ["totalRounds"], message: "Укажите число раундов" });
  });
```

### `src/lib/services/tournament.ts`

_createTournament — вставка турнира, статус задаётся сервером._

```typescript
export async function createTournament(prisma: PrismaClient, data: CreateTournamentInput) {
  // статус всегда "registration" (не из формы)
  return prisma.tournament.create({
    data: {
      name: data.name,
      size: data.size,
      status: "registration",
      date: data.date ?? null,
      location: data.location ?? null,
      format: data.format,
      participantMode: data.participantMode,
      level: data.level,
      price: data.price ?? null,
      scoringMode: data.scoringMode,
      totalRounds: data.totalRounds ?? null,
    },
    select: tournamentSelect,
  });
}
```

## 3. Регистрация участников

Транзакционный гейт регистрации пары. Все проверки и вставка выполняются в одной `prisma.$transaction`, поэтому подсчёт и запись не могут «разъехаться» при гонке: статус открыт, режим участия, отсутствие самопартнёрства, лимит мест, кросс-слотовый дубликат игрока и совпадение уровня. Каждый отказ — типизированная ошибка `RegistrationError` с русским сообщением.

### `src/lib/services/registration.ts`

_registerPair — атомарная регистрация пары со всеми проверками целостности._

```typescript
// Все проверки и вставка — в одной транзакции (истина в БД).
export async function registerPair(
  prisma: PrismaClient,
  { tournamentId, player1Id, player2Id }: RegisterPairArgs,
) {
  return prisma.$transaction(async (tx) => {
    // (1) статус: регистрация открыта
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, size: true, level: true, participantMode: true },
    });
    if (tournament.status !== "registration") {
      throw new RegistrationError("not_open", "Регистрация на турнир закрыта");
    }

    // (1b) режим: турнир парный
    if (tournament.participantMode !== "pairs") {
      throw new RegistrationError("wrong_mode", "На этот турнир регистрация только одиночная");
    }

    // (2) нельзя пару с самим собой
    if (player1Id === player2Id) {
      throw new RegistrationError("self_partner", "Нельзя зарегистрироваться в паре с самим собой");
    }

    // (3) лимит мест
    const count = await tx.pair.count({ where: { tournamentId } });
    if (count >= tournament.size) {
      throw new RegistrationError("tournament_full", "Турнир заполнен");
    }

    // (4) игрок уже в турнире (в любом слоте)
    const existing = await tx.pair.findFirst({
      where: {
        tournamentId,
        OR: [
          { player1Id: { in: [player1Id, player2Id] } },
          { player2Id: { in: [player1Id, player2Id] } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new RegistrationError("already_registered", "Один из игроков уже участвует в этом турнире");
    }

    // (4b) уровень обоих игроков = уровню турнира
    const players = await tx.user.findMany({
      where: { id: { in: [player1Id, player2Id] } },
      select: { id: true, skillLevel: true },
    });
    if (players.some((p) => p.skillLevel !== tournament.level)) {
      throw new RegistrationError("level_mismatch", "Уровень игрока не совпадает с уровнем турнира");
    }

    // (5) вставка (все проверки пройдены)
    return tx.pair.create({
      data: { tournamentId, player1Id, player2Id },
      select: pairSelect,
    });
  });
}
```

## 4. Проведение турнира: диспетчеризация форматов

Единая точка маршрутизации «Старта»: `startFormat` читает формат турнира из БД (источник истины — формат, заявленный клиентом, не принимается) и вызывает соответствующий генератор структуры. Именно здесь система ветвится на все четыре формата; сами генераторы (playoff, round-robin, американо, мексикано) реализованы в отдельных модулях. Симметричный `recordFormatResult` так же маршрутизирует запись результата по формату.

### `src/lib/services/format-engine.ts`

_startFormat — диспетчер старта турнира по формату (playoff / round_robin / americano / mexicano)._

```typescript
// Маршрутизация «Старта» по формату турнира (из БД).
export async function startFormat(prisma: PrismaClient, tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { format: true },
  });

  switch (tournament.format) {
    case "playoff":
      return generateBracket(prisma, tournamentId);
    case "round_robin":
      return generateRoundRobin(prisma, tournamentId);
    case "americano":
      return generateAmericano(prisma, tournamentId);
    case "mexicano":
      return generateMexicanoRound1(prisma, tournamentId);
    default:
      throw new Error(`Неизвестный формат турнира: "${tournament.format}"`);
  }
}
```

## 5. Проведение турнира: генерация олимпийской сетки (playoff)

Ядро олимпийской сетки. `advance` — чистая слот-арифметика: куда идёт победитель матча `(round, position)`. `generateBracket` за одну транзакцию перечитывает турнир (источник истины), перемешивает пары (Fisher–Yates), создаёт всё дерево из `size−1` матчей «от финала к первому раунду» (чтобы каждый дочерний матч ссылался на уже созданного родителя через `nextMatchId`/`nextSlot`) и переводит статус в `in_progress`. Повторная генерация запрещена (guard + уникальное ограничение БД).

### `src/lib/services/bracket.ts`

_advance + generateBracket — построение дерева single-elimination 4/8/16 в одной транзакции._

```typescript
// Куда идёт победитель матча (round, position): в round+1,
// floor(position/2); чётная позиция → A, нечётная → B.
export function advance(
  round: number,
  position: number,
): { round: number; position: number; slot: Slot } {
  return {
    round: round + 1,
    position: Math.floor(position / 2),
    slot: position % 2 === 0 ? "A" : "B",
  };
}

// Строит всё дерево сетки в одной транзакции (источник истины — БД).
export async function generateBracket(prisma: PrismaClient, tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    // (1) турнир открыт для регистрации
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, size: true },
    });
    if (tournament.status !== "registration") {
      throw new BracketError("not_open", `Нельзя сгенерировать сетку: турнир в статусе "${tournament.status}"`);
    }

    const size = tournament.size;
    const rounds = ROUNDS[size];
    // (2) size — степень двойки, число пар совпадает
    if (!rounds) {
      throw new BracketError("bad_size", `Недопустимый размер турнира: ${size} (ожидается 4, 8 или 16)`);
    }
    const pairCount = await tx.pair.count({ where: { tournamentId } });
    if (pairCount !== size) {
      throw new BracketError("wrong_count", `Нужно ровно ${size} пар для старта (зарегистрировано ${pairCount})`);
    }

    // (3) матчи ещё не созданы (защита от повтора)
    const existing = await tx.match.count({ where: { tournamentId } });
    if (existing > 0) {
      throw new BracketError("already_generated", "Сетка уже сгенерирована — повторная генерация запрещена");
    }

    // (4) пары: перемешать, назначить посев 1..size
    const pairs = await tx.pair.findMany({
      where: { tournamentId },
      select: { id: true },
    });
    const shuffled = shuffle(pairs);
    for (let i = 0; i < shuffled.length; i++) {
      await tx.pair.update({
        where: { id: shuffled[i].id },
        data: { seed: i + 1 },
      });
    }

    // (5) матчи от финала к 1-му раунду:
    // ребёнок ссылается на готового родителя
    const matchIdsByRound: Record<number, Record<number, string>> = {};
    const finalRound = rounds.length;
    for (let round = finalRound; round >= 1; round--) {
      const countInRound = rounds[round - 1];
      matchIdsByRound[round] = {};
      for (let position = 0; position < countInRound; position++) {
        let nextMatchId: string | null = null;
        let nextSlot: string | null = null;
        if (round < finalRound) {
          const parent = advance(round, position);
          nextMatchId = matchIdsByRound[parent.round][parent.position];
          nextSlot = parent.slot;
        }
        // (6) 1-й раунд: две пары; дальше — null
        let pairAId: string | null = null;
        let pairBId: string | null = null;
        if (round === 1) {
          pairAId = shuffled[position * 2].id;
          pairBId = shuffled[position * 2 + 1].id;
        }
        let created;
        try {
          created = await tx.match.create({
            data: {
              tournamentId,
              round,
              position,
              pairAId,
              pairBId,
              nextMatchId,
              nextSlot,
            },
            select: { id: true },
          });
        } catch (e) {
          // гонка: слот уже создан
          if (isUniqueViolation(e)) {
            throw new BracketError("already_generated", "Сетка уже сгенерирована — повторная генерация запрещена");
          }
          throw e;
        }
        matchIdsByRound[round][position] = created.id;
      }
    }

    // (7) статус → in_progress (автомат статусов)
    await transitionTournament(tx as unknown as PrismaClient, tournamentId, "registration", "in_progress");

    return { tournamentId, matchesCreated: matchCount(size) };
  });
}
```

## 6. Проведение турнира: ротация (американо)

Показательный алгоритм неплейоффного формата. `americanoSchedule` — чистая детерминированная функция (circle method на игроках), гарантирующая **partner-once**: за `N−1` раундов каждый играет в паре с каждым ровно один раз. Обрабатывает нечётное число игроков (BYE) и случай `N≡2 (mod 4)`. Persistence (`generateAmericano`) устроена аналогично `generateBracket` и в листинг не вынесена. Мексикано отличается тем, что материализует раунды по одному из текущего рейтинга.

### `src/lib/services/americano.ts`

_americanoSchedule — ротация партнёров (circle method), partner-once._

```typescript
// Circle method на игроках: чистая детерминированная функция.
// partner-once: за N-1 раундов каждый сыграет в паре с каждым.
// Нечётное N → BYE (один отдыхает); N≡2(mod4) → отдыхают двое.
export function americanoSchedule<T>(players: T[]): AmericanoRound<T>[] {
  const padded: (T | null)[] = players.slice();
  if (padded.length % 2 !== 0) {
    padded.push(null); // BYE: при нечётном N один отдыхает
  }

  const n = padded.length;
  const rounds = n - 1;
  const half = n / 2;
  const schedule: AmericanoRound<T>[] = [];

  const fixed = padded[0];
  let ring = padded.slice(1); // arr[0] не вращается
  for (let r = 0; r < rounds; r++) {
    const arr = [fixed, ...ring];

    // партнёрства: позиции (i, N-1-i)
    const partnerships: [T, T][] = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      // партнёрство с BYE отдыхает
      if (a === null || b === null) continue;
      partnerships.push([a, b]);
    }

    // корты: партнёрство(2k) vs (2k+1);
    // при нечётном числе последнее отдыхает
    const courts: AmericanoCourt<T>[] = [];
    for (let k = 0; 2 * k + 1 < partnerships.length; k++) {
      courts.push({
        courtNumber: courts.length,
        teamA: partnerships[2 * k],
        teamB: partnerships[2 * k + 1],
      });
    }
    schedule.push({ roundNumber: r + 1, courts });

    // сдвиг ring на один; fixed на месте
    ring = [ring[ring.length - 1], ...ring.slice(0, ring.length - 1)];
  }

  return schedule;
}
```

## 7. Подсчёт результата и продвижение (playoff)

`recordResult` записывает (или перезаписывает) результат матча в одной транзакции: проверяет, что соперники определены; счёт **free-form** (любое число сетов, любые геймы, без лимитов); определяет победителя (больше сетов, при равенстве — больше геймов; ничья в playoff запрещена); сохраняет сеты и кэш `setsWonA/B`; **продвигает** победителя в готовый слот родительского матча; на финале — завершает турнир. Победитель выводится на сервере и всегда ∈ {pairA, pairB} — из запроса не принимается.

### `src/lib/services/result.ts`

_recordResult — транзакционная запись счёта, продвижение победителя, авто-финиш._

```typescript
export async function recordResult(
  prisma: PrismaClient,
  matchId: string,
  sets: SetInput[],
): Promise<RecordResultSummary> {
  return prisma.$transaction(async (tx) => {
    // (1) матч из БД; счёт free-form
    const match = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        pairAId: true,
        pairBId: true,
        nextMatchId: true,
        nextSlot: true,
      },
    });

    // (2) соперники должны быть определены
    if (!match.pairAId || !match.pairBId) {
      throw new ResultError(
        "slots_unfilled",
        "Нельзя ввести результат: соперники ещё не определены",
      );
    }

    // (3) хотя бы один сет
    if (sets.length === 0) {
      throw new ResultError("empty", "Не указано ни одного сета");
    }

    // (4) считаем выигранные сеты
    const { setsWonA, setsWonB } = tallySetsWon(sets);

    // (5) победитель: больше сетов, потом геймов;
    // ничья в playoff запрещена
    const winnerSide = matchWinnerFromSets(sets);
    if (winnerSide === null) {
      throw new ResultError(
        "draw",
        "Ничья недопустима в playoff — введите решающий счёт",
      );
    }
    const winnerId = winnerSide === "A" ? match.pairAId : match.pairBId;
    // winnerId ∈ {pairAId, pairBId}
    if (winnerId !== match.pairAId && winnerId !== match.pairBId) {
      throw new ResultError("no_winner", "Внутренняя ошибка: победитель не из пары матча");
    }

    // (6) перезапись сетов: удалить, вставить 1..n
    await tx.setScore.deleteMany({ where: { matchId } });
    for (let i = 0; i < sets.length; i++) {
      await tx.setScore.create({
        data: {
          matchId,
          setNumber: i + 1,
          gamesPair1: sets[i].gamesPair1,
          gamesPair2: sets[i].gamesPair2,
        },
      });
    }

    // (7) кэш счёта + winnerId
    await tx.match.update({
      where: { id: matchId },
      data: { setsWonA, setsWonB, winnerId },
    });

    // (8) продвигаем победителя в слот родителя
    if (match.nextMatchId) {
      await tx.match.update({
        where: { id: match.nextMatchId },
        data: match.nextSlot === "A" ? { pairAId: winnerId } : { pairBId: winnerId },
      });
    }

    // (9) финал (нет родителя) → завершаем турнир;
    // уже finished → no-op
    let finished = false;
    if (!match.nextMatchId) {
      const trn = await tx.tournament.findUniqueOrThrow({
        where: { id: match.tournamentId },
        select: { status: true },
      });
      if (trn.status === "finished") {
        finished = true; // уже finished — пропуск
      } else {
        await transitionTournament(
          tx as unknown as PrismaClient,
          match.tournamentId,
          "in_progress",
          "finished",
        );
        finished = true;
      }
    }

    return { matchId, winnerId, setsWonA, setsWonB, finished };
  });
}
```

## 8. Расчёт турнирной таблицы (standings)

Рейтинг вычисляется на лету (derived) и никогда не материализуется — пересчёт при каждом чтении исключает рассинхрон. Показаны чистые функции сортировки с детерминированными tiebreak-цепочками: `rankPlayers` (американо/мексикано — по сумме личных очков) и `rankUnits` (round-robin — по победам/разнице). Финальный ключ-стабилизатор (`userId`/`unitId` по возрастанию) делает результат воспроизводимым — на нём же держится разбиение на квартеты в мексикано.

### `src/lib/services/standings.ts`

_rankPlayers / rankUnits — детерминированная сортировка рейтинга._

```typescript
// Рейтинг для американо/мексикано. Тай-брейки:
// sumFor → разница → победы → userId (стабильно).
export function rankPlayers(
  rows: { userId: string; sumFor: number; sumAgainst: number; wins: number; played: number }[],
): PlayerStanding[] {
  return [...rows]
    .sort((a, b) => {
      if (b.sumFor !== a.sumFor) return b.sumFor - a.sumFor;
      const da = a.sumFor - a.sumAgainst;
      const db = b.sumFor - b.sumAgainst;
      if (db !== da) return db - da;
      if (b.wins !== a.wins) return b.wins - a.wins;
      // стабильный ключ: userId по возрастанию
      return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
    })
    .map((r, i) => ({
      userId: r.userId,
      rank: i + 1,
      played: r.played,
      wins: r.wins,
      pointsFor: r.sumFor,
      pointsAgainst: r.sumAgainst,
      pointDiff: r.sumFor - r.sumAgainst,
    }));
}

// Таблица round_robin. Тай-брейки:
// победы → разница → очки → unitId (стабильно).
function rankUnits(units: Omit<UnitStanding, "rank">[]): UnitStanding[] {
  return [...units]
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0;
    })
    .map((u, i) => ({ ...u, rank: i + 1 }));
}
```

---

## Примечание

Для краткости в листинг не вынесены: типизированные классы ошибок (`BracketError`/`ResultError`/`FormatError`), вторая половина диспетчера — запись результата (`recordFormatResult`), реализация round-robin/мексикано и подсчёта round-based (`round-result.ts`), серверные действия (`actions.ts`), конфигурация Better Auth, React-компоненты визуализации и тесты. Приведённые фрагменты раскрывают логику ядра; остальные модули построены по тем же паттернам (сервис принимает `prisma`, запись — в транзакции, отказ — типизированная ошибка с русским сообщением).
