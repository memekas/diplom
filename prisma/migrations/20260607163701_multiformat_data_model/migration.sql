/*
  Warnings:

  - Made the column `skillLevel` on table `user` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "tournament_player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournament_player_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tournament_player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "round_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "round_match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "courtNumber" INTEGER NOT NULL,
    "teamA1Id" TEXT,
    "teamA2Id" TEXT,
    "teamB1Id" TEXT,
    "teamB2Id" TEXT,
    "pointsA" INTEGER,
    "pointsB" INTEGER,
    CONSTRAINT "round_match_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "round" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "round_match_teamA1Id_fkey" FOREIGN KEY ("teamA1Id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "round_match_teamA2Id_fkey" FOREIGN KEY ("teamA2Id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "round_match_teamB1Id_fkey" FOREIGN KEY ("teamB1Id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "round_match_teamB2Id_fkey" FOREIGN KEY ("teamB2Id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "player_match_score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundMatchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamSlot" TEXT NOT NULL,
    "pointsFor" INTEGER NOT NULL,
    "pointsAgainst" INTEGER NOT NULL,
    CONSTRAINT "player_match_score_roundMatchId_fkey" FOREIGN KEY ("roundMatchId") REFERENCES "round_match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_match_score_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registration',
    "date" DATETIME,
    "location" TEXT,
    "setsPerMatch" INTEGER NOT NULL DEFAULT 3,
    "gamesPerSet" INTEGER NOT NULL DEFAULT 6,
    "format" TEXT NOT NULL DEFAULT 'playoff',
    "participantMode" TEXT NOT NULL DEFAULT 'pairs',
    "level" TEXT NOT NULL DEFAULT 'intermediate',
    "price" INTEGER,
    "scoringMode" TEXT NOT NULL DEFAULT 'sets',
    "targetPoints" INTEGER,
    "totalRounds" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_tournament" ("createdAt", "date", "gamesPerSet", "id", "location", "name", "setsPerMatch", "size", "status") SELECT "createdAt", "date", "gamesPerSet", "id", "location", "name", "setsPerMatch", "size", "status" FROM "tournament";
DROP TABLE "tournament";
ALTER TABLE "new_tournament" RENAME TO "tournament";
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" DATETIME,
    "courtSide" TEXT NOT NULL DEFAULT 'either',
    "nickname" TEXT NOT NULL,
    "phone" TEXT,
    "skillLevel" TEXT NOT NULL,
    "birthDate" DATETIME
);
INSERT INTO "new_user" ("banExpires", "banReason", "banned", "courtSide", "createdAt", "email", "emailVerified", "id", "image", "name", "nickname", "phone", "role", "skillLevel", "updatedAt") SELECT "banExpires", "banReason", "banned", "courtSide", "createdAt", "email", "emailVerified", "id", "image", "name", "nickname", "phone", "role", "skillLevel", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "user_nickname_key" ON "user"("nickname");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "tournament_player_tournamentId_idx" ON "tournament_player"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_player_tournamentId_userId_key" ON "tournament_player"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "round_tournamentId_roundNumber_key" ON "round"("tournamentId", "roundNumber");

-- CreateIndex
CREATE INDEX "round_match_roundId_idx" ON "round_match"("roundId");

-- CreateIndex
CREATE INDEX "player_match_score_userId_idx" ON "player_match_score"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "player_match_score_roundMatchId_userId_key" ON "player_match_score"("roundMatchId", "userId");
