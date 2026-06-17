# Листинг исходного кода ключевых компонентов системы

В приложении приведён не весь код проекта, а только ключевые, наиболее показательные фрагменты — отдельные функции и модели, раскрывающие архитектуру и доменную логику системы: модель данных, создание и регистрацию на турнир, генерацию турнирной структуры, подсчёт результата с продвижением и расчёт турнирной таблицы. Полные исходные тексты остальных модулей (другие форматы, серверные действия, валидация, интерфейс, тесты) в листинг не вынесены.

> **Стек:** Next.js 16 (App Router, TypeScript) — Server Components для чтения и Server Actions для записи; Prisma 6 + SQLite; Zod 4; Better Auth 1.6.
> Каждый фрагмент снабжён путём к файлу и кратким пояснением. Объём рассчитан на печать **одинарным** интервалом (~15 стр.).

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
Фрагмент: источник данных и доменные модели.

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Tournament {
  id           String    @id @default(cuid())
  name         String
  size         Int // 4 | 8 | 16 — проверяется на уровне приложения через zod
  status       String    @default("registration") // "registration" | "in_progress" | "finished"
  date         DateTime?
  location     String?
  // --- Конфигурация мультиформатности. Все поля аддитивны: значения по умолчанию сохраняют прежнее чтение. ---
  format          String  @default("playoff")     // "playoff"|"round_robin"|"americano"|"mexicano"
  participantMode String  @default("pairs")        // "pairs"|"singles"
  level           String  @default("intermediate") // один из 5 уровней мастерства
  price           Int?    // стоимость участия в рублях; null = бесплатно/не задано
  scoringMode     String  @default("sets")         // "sets"|"points"
  totalRounds     Int?    // число раундов для mexicano; для americano не используется
  createdAt    DateTime  @default(now())
  // Обратные связи к парам и матчам.
  pairs        Pair[]
  matches      Match[]
  // Обратные связи round-based моделей.
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
  seed         Int? // заполняется при генерации сетки: номер посева 1..size
  createdAt    DateTime   @default(now())
  // Обратные связи к матчам: пара может быть в слоте A или B и побеждать;
  // три именованные связи различают три внешних ключа в Match.
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
  round         Int // 1 = первый раунд; максимальный раунд = финал
  position      Int // индекс внутри раунда с нуля (порядок отрисовки)
  pairAId       String?
  pairA         Pair?      @relation("MatchPairA", fields: [pairAId], references: [id])
  pairBId       String?
  pairB         Pair?      @relation("MatchPairB", fields: [pairBId], references: [id])
  winnerId      String? // заполняется при продвижении победителя
  winner        Pair?      @relation("MatchWinner", fields: [winnerId], references: [id])
  // Кэш числа выигранных сетов по сторонам (только для отображения;
  // источник истины для продвижения — winnerId). Null до записи результата.
  setsWonA      Int?
  setsWonB      Int?
  // Счёт по сетам. Удаляется каскадно вместе с матчем; при правке
  // результата перезаписывается целиком.
  setScores     SetScore[]
  // Указатель продвижения: победитель этого матча занимает слот nextSlot ("A"|"B")
  // родительского матча nextMatch. Самосвязь "Bracket": nextMatch — родитель,
  // feederMatches — дети. У финального матча nextMatchId/nextSlot равны null.
  nextMatchId   String?
  nextMatch     Match?     @relation("Bracket", fields: [nextMatchId], references: [id])
  feederMatches Match[]    @relation("Bracket")
  nextSlot      String? // "A" | "B"

  // Структурный инвариант и защита от повторной генерации: не более одного матча
  // на (tournament, round, position) — параллельный двойной старт упадёт здесь при создании.
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
  status       String       @default("pending") // "pending" | "in_progress" | "finished"
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
  pointsA      Int?    // очки команды A в режиме очков (null до записи)
  pointsB      Int?    // очки команды B в режиме очков (null до записи)
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
Фрагмент: схема валидации.

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
    totalRounds: z.coerce.number().int().positive().optional(), // число раундов для mexicano; для americano не используется
    // Необязательная дата: пустая строка → undefined; иначе должна быть валидной датой.
    date: z
      .union([z.literal(""), z.coerce.date()])
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : v)),
    // Необязательное место: обрезаем пробелы, пустое → undefined.
    location: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : v)),
  })
  .superRefine((d, ctx) => {
    // Правила размера в зависимости от формата.
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
    // Принудительный режим участия: американо/мексикано — только одиночные.
    if ((d.format === "americano" || d.format === "mexicano") && d.participantMode !== "singles")
      ctx.addIssue({
        code: "custom",
        path: ["participantMode"],
        message: "Американо/Мексикано — только одиночная регистрация",
      });
    // Режим подсчёта: американо/мексикано используют очки, а не сеты.
    if ((d.format === "americano" || d.format === "mexicano") && d.scoringMode === "sets")
      ctx.addIssue({
        code: "custom",
        path: ["scoringMode"],
        message: "Для американо/мексикано используйте режим очков",
      });
    // Мексикано материализует раунды по одному и завершается автоматически только при
    // roundNumber >= totalRounds. При totalRounds=null эта ветка недостижима и турнир
    // никогда не завершится, поэтому поле обязательно. (Американо выводит N−1 раундов
    // из circle method и totalRounds игнорирует.)
    if (d.format === "mexicano" && d.totalRounds == null)
      ctx.addIssue({ code: "custom", path: ["totalRounds"], message: "Укажите число раундов" });
  });
```

### `src/lib/services/tournament.ts`

_createTournament — вставка турнира, статус задаётся сервером._
Фрагмент: функция создания.

```typescript
export async function createTournament(prisma: PrismaClient, data: CreateTournamentInput) {
  // статус жёстко задаётся как "registration" на сервере и никогда не
  // принимается из пользовательского ввода.
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
Фрагмент: функция регистрации пары.

```typescript
// Атомарный гейт регистрации. БД — источник истины: перечитываем статус,
// считаем заполненность, проверяем кросс-слотовый дубликат и делаем вставку — всё
// в ОДНОЙ prisma.$transaction, поэтому подсчёт и вставка не могут «разъехаться»
// при гонке, а переполнение и повторная регистрация не пройдут параллельно.
// Сервис принимает prisma (экшены остаются тонкими).
export async function registerPair(
  prisma: PrismaClient,
  { tournamentId, player1Id, player2Id }: RegisterPairArgs,
) {
  return prisma.$transaction(async (tx) => {
    // (1) Перечитываем статус — регистрация должна быть открыта. Состоянию,
    // заявленному клиентом, не доверяем; истина — строка в БД.
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, size: true, level: true, participantMode: true },
    });
    if (tournament.status !== "registration") {
      throw new RegistrationError("not_open", "Регистрация на турнир закрыта");
    }

    // (1b) Проверка режима — парный путь требует парного турнира. Режиму из
    // формы не доверяем; истина — строка в БД.
    if (tournament.participantMode !== "pairs") {
      throw new RegistrationError("wrong_mode", "На этот турнир регистрация только одиночная");
    }

    // (2) Защита от пары с самим собой — уникальные ограничения это не ловят.
    if (player1Id === player2Id) {
      throw new RegistrationError("self_partner", "Нельзя зарегистрироваться в паре с самим собой");
    }

    // (3) Лимит мест — отказываем при достижении size.
    const count = await tx.pair.count({ where: { tournamentId } });
    if (count >= tournament.size) {
      throw new RegistrationError("tournament_full", "Турнир заполнен");
    }

    // (4) Кросс-слотовый дубликат — игрок уже присутствует как player1 ИЛИ player2
    // в любой паре турнира. Это ловит случай, когда игрок player1 в одной паре и
    // player2 в другой; пер-слотовые @@unique — защита в глубину, а не замена.
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

    // (4b) Совпадение уровня — строгое равенство для ОБОИХ игроков. Читаем оба
    // skillLevel в той же транзакции; если хоть один отличается от уровня турнира —
    // отказ. Пары со смешанным уровнем недопустимы.
    const players = await tx.user.findMany({
      where: { id: { in: [player1Id, player2Id] } },
      select: { id: true, skillLevel: true },
    });
    if (players.some((p) => p.skillLevel !== tournament.level)) {
      throw new RegistrationError("level_mismatch", "Уровень игрока не совпадает с уровнем турнира");
    }

    // (5) Вставка — достижима только когда пройдены все проверки.
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
Фрагмент: маршрутизация форматов.

```typescript
// startFormat: маршрутизация «Старта» по полю tournament.format.
//   playoff      → generateBracket
//   round_robin  → generateRoundRobin
//   americano    → generateAmericano
//   mexicano     → generateMexicanoRound1
// generateBracket бросает BracketError, три round-based генератора — FormatError;
// вызывающий экшен обрабатывает оба типа. Неизвестный формат → обычный Error
// (защитно; enum схемы делает это недостижимым на практике).
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
Фрагмент: слот-арифметика и генерация сетки.

```typescript
// Для матча (round, position): куда идёт его победитель? Родительский матч —
// в round+1 на позиции floor(position/2); чётные позиции дают слот A, нечётные — B.
// Чистая функция без Prisma — математика не зависит от БД.
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

// Генерирует всё дерево олимпийской сетки в ОДНОЙ транзакции. БД — источник
// истины: статус, число пар и отсутствие уже созданных матчей перечитываются
// внутри транзакции, поэтому вызывающий код их не обойдёт. Любое исключение
// откатывает всю транзакцию: ни частичной сетки, ни посевов без матчей.
// Однократность генерации обеспечивается на уровне данных.
export async function generateBracket(prisma: PrismaClient, tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    // (1) Перечитываем турнир — должен быть открыт для регистрации.
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { id: true, status: true, size: true },
    });
    if (tournament.status !== "registration") {
      throw new BracketError("not_open", `Нельзя сгенерировать сетку: турнир в статусе "${tournament.status}"`);
    }

    const size = tournament.size;
    const rounds = ROUNDS[size];
    // (2) size — поддерживаемая степень двойки И число пар точно совпадает.
    if (!rounds) {
      throw new BracketError("bad_size", `Недопустимый размер турнира: ${size} (ожидается 4, 8 или 16)`);
    }
    const pairCount = await tx.pair.count({ where: { tournamentId } });
    if (pairCount !== size) {
      throw new BracketError("wrong_count", `Нужно ровно ${size} пар для старта (зарегистрировано ${pairCount})`);
    }

    // (3) Неизменяемость: отказываем, если хоть один матч уже создан — никакой
    // повторной жеребьёвки или генерации после построения сетки. Ограничение
    // @@unique([tournamentId, round, position]) страхует от параллельного двойного старта.
    const existing = await tx.match.count({ where: { tournamentId } });
    if (existing > 0) {
      throw new BracketError("already_generated", "Сетка уже сгенерирована — повторная генерация запрещена");
    }

    // (4) Загружаем пары, перемешиваем (Fisher–Yates), назначаем посев 1..size.
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

    // (5) Создаём матчи ОТ ФИНАЛА (раунды от старших к младшим), чтобы каждый
    // ребёнок ссылался на уже созданного родителя. matchIdsByRound[round][position] = id.
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
        // (6) Матчи первого раунда получают две разные перемешанные пары; дальше — null (TBD).
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
          // Страховка от гонки: параллельный старт уже создал этот слот.
          if (isUniqueViolation(e)) {
            throw new BracketError("already_generated", "Сетка уже сгенерирована — повторная генерация запрещена");
          }
          throw e;
        }
        matchIdsByRound[round][position] = created.id;
      }
    }

    // (7) Переводим статус registration → in_progress через единый автомат статусов.
    // transitionTournament перечитывает и проверяет переход в этой же транзакции.
    await transitionTournament(tx as unknown as PrismaClient, tournamentId, "registration", "in_progress");

    return { tournamentId, matchesCreated: matchCount(size) };
  });
}
```

## 6. Проведение турнира: ротация (американо)

Показательный алгоритм неплейоффного формата. `americanoSchedule` — чистая детерминированная функция (circle method на игроках), гарантирующая **partner-once**: за `N−1` раундов каждый играет в паре с каждым ровно один раз. Обрабатывает нечётное число игроков (BYE) и случай `N≡2 (mod 4)`. Persistence (`generateAmericano`) устроена аналогично `generateBracket` и в листинг не вынесена. Мексикано отличается тем, что материализует раунды по одному из текущего рейтинга.

### `src/lib/services/americano.ts`

_americanoSchedule — ротация партнёров (circle method), partner-once._
Фрагмент: алгоритм расписания.

```typescript
// Circle method на ИГРОКАХ. Чистая, обобщённая, детерминированная для
// фиксированного входа функция (без внутреннего перемешивания). Гарантирует
// PARTNER-ONCE: за N-1 раундов каждый игрок играет в паре с каждым ровно один раз.
// ⚠️ Одновременная уникальность соперников НЕ гарантируется — это нормально.
//
//   - Чётное N → N-1 раундов. arr = [fixed, ...ring]; партнёрства = позиции (i, N-1-i);
//     корт k = партнёрство(2k) против партнёрства(2k+1); ring сдвигается на один
//     каждый раунд, arr[0] зафиксирован навсегда.
//   - Нечётное N → добавляется метка BYE (null) → один игрок отдыхает каждый раунд.
//   - N≡2 (mod 4) → нечётное число валидных партнёрств → последнее непарное
//     партнёрство отдыхает (для него корт не создаётся) → отдыхают 2 игрока.
//   - courtNumber нумеруется с нуля по РЕАЛЬНО созданным кортам (без пропусков).
export function americanoSchedule<T>(players: T[]): AmericanoRound<T>[] {
  const padded: (T | null)[] = players.slice();
  if (padded.length % 2 !== 0) {
    padded.push(null); // метка BYE — при нечётном N один игрок отдыхает каждый раунд
  }

  const n = padded.length;
  const rounds = n - 1;
  const half = n / 2;
  const schedule: AmericanoRound<T>[] = [];

  const fixed = padded[0];
  let ring = padded.slice(1); // вращающаяся часть; arr[0] никогда не вращается
  for (let r = 0; r < rounds; r++) {
    const arr = [fixed, ...ring];

    // Партнёрства из позиций (i, N-1-i): (arr[0],arr[N-1]),(arr[1],arr[N-2]),...
    const partnerships: [T, T][] = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      // Партнёрство с BYE отдыхает — команда не создаётся.
      if (a === null || b === null) continue;
      partnerships.push([a, b]);
    }

    // Корты: партнёрство(2k) против партнёрства(2k+1). Если число валидных партнёрств
    // нечётно (N≡2 mod 4), последнее непарное партнёрство отдыхает — корта для него нет.
    const courts: AmericanoCourt<T>[] = [];
    for (let k = 0; 2 * k + 1 < partnerships.length; k++) {
      courts.push({
        courtNumber: courts.length,
        teamA: partnerships[2 * k],
        teamB: partnerships[2 * k + 1],
      });
    }
    schedule.push({ roundNumber: r + 1, courts });

    // Сдвигаем ring на один (последний элемент — в начало); arr[0]/fixed остаётся на месте.
    ring = [ring[ring.length - 1], ...ring.slice(0, ring.length - 1)];
  }

  return schedule;
}
```

## 7. Подсчёт результата и продвижение (playoff)

`recordResult` записывает (или перезаписывает) результат матча в одной транзакции: проверяет, что соперники определены; счёт **free-form** (любое число сетов, любые геймы, без лимитов); определяет победителя (больше сетов, при равенстве — больше геймов; ничья в playoff запрещена); сохраняет сеты и кэш `setsWonA/B`; **продвигает** победителя в готовый слот родительского матча; на финале — завершает турнир. Победитель выводится на сервере и всегда ∈ {pairA, pairB} — из запроса не принимается.

### `src/lib/services/result.ts`

_recordResult — транзакционная запись счёта, продвижение победителя, авто-финиш._
Фрагмент: функция записи результата.

```typescript
export async function recordResult(
  prisma: PrismaClient,
  matchId: string,
  sets: SetInput[],
): Promise<RecordResultSummary> {
  return prisma.$transaction(async (tx) => {
    // (1) Загружаем матч (истина в БД). Конфигурация сетов/геймов не читается — счёт free-form.
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

    // (2) Отказ, если слот соперника не заполнен — нельзя вводить результат, пока
    // соперники не определены.
    if (!match.pairAId || !match.pairBId) {
      throw new ResultError(
        "slots_unfilled",
        "Нельзя ввести результат: соперники ещё не определены",
      );
    }

    // (3) Отказ при пустом вводе. Число сетов любое — без верхнего предела.
    if (sets.length === 0) {
      throw new ResultError("empty", "Не указано ни одного сета");
    }

    // (4) Считаем выигранные сеты (free-form: больше геймов выигрывает сет; ничья — никому).
    const { setsWonA, setsWonB } = tallySetsWon(sets);

    // (5) Определяем победителя матча (больше сетов, при равенстве — больше геймов).
    // В playoff нужен решающий победитель — ничья не продвигается, поэтому отказ.
    const winnerSide = matchWinnerFromSets(sets);
    if (winnerSide === null) {
      throw new ResultError(
        "draw",
        "Ничья недопустима в playoff — введите решающий счёт",
      );
    }
    const winnerId = winnerSide === "A" ? match.pairAId : match.pairBId;
    // Защитная проверка: winnerId ∈ {pairAId, pairBId} по построению.
    if (winnerId !== match.pairAId && winnerId !== match.pairBId) {
      throw new ResultError("no_winner", "Внутренняя ошибка: победитель не из пары матча");
    }

    // (6) Перезаписываем все сеты (свободная правка): удаляем, затем вставляем 1..n.
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

    // (7) Сохраняем кэш счёта и winnerId в этом матче.
    await tx.match.update({
      where: { id: matchId },
      data: { setsWonA, setsWonB, winnerId },
    });

    // (8) Продвижение: записываем победителя в уже существующий слот родителя.
    // Это UPDATE (родитель создан при генерации). При перезаписи слот обновляется
    // (возможно, новым) победителем — только для НЕПОСРЕДСТВЕННОГО родителя;
    // каскадная очистка ниже по дереву вне рамок (принято).
    if (match.nextMatchId) {
      await tx.match.update({
        where: { id: match.nextMatchId },
        data: match.nextSlot === "A" ? { pairAId: winnerId } : { pairBId: winnerId },
      });
    }

    // (9) Финал: нет родителя → завершаем турнир. При перезаписи уже завершённого
    // турнира transitionTournament отверг бы устаревший `from` — поэтому перечитываем
    // статус и трактуем уже-"finished" как no-op.
    let finished = false;
    if (!match.nextMatchId) {
      const trn = await tx.tournament.findUniqueOrThrow({
        where: { id: match.tournamentId },
        select: { status: true },
      });
      if (trn.status === "finished") {
        finished = true; // уже завершён (перезапись финала) — переход не нужен.
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
Фрагмент: функции ранжирования.

```typescript
// Чистая сортировка рейтинга для американо/мексикано. Цепочка тай-брейков:
//   sumFor по убыв. → pointDiff (sumFor−sumAgainst) по убыв. → wins по убыв. → userId по возр.
// Финальный ключ userId-по-возрастанию — стабильный детерминированный запасной
// вариант, на который опирается разбиение в мексикано. НЕ мутирует вход (сортирует копию).
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
      // Стабильный детерминированный запасной ключ — сравнение userId по возрастанию.
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

// Чистая сортировка таблицы для round_robin. Цепочка:
//   победы по убыв. → pointDiff по убыв. → pointsFor по убыв. → unitId по возр.
// (Тай-брейки по геймам / личным встречам недоступны без миграции — сеты хранят
// только число выигранных сетов; задокументированное упрощение.) Стабильный
// финальный ключ unitId-по-возрастанию делает таблицу детерминированной. НЕ мутирует вход.
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
