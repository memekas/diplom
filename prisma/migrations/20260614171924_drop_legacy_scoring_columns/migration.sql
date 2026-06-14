/*
  Warnings:

  - You are about to drop the column `gamesPerSet` on the `tournament` table. All the data in the column will be lost.
  - You are about to drop the column `setsPerMatch` on the `tournament` table. All the data in the column will be lost.
  - You are about to drop the column `targetPoints` on the `tournament` table. All the data in the column will be lost.

*/
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
    "format" TEXT NOT NULL DEFAULT 'playoff',
    "participantMode" TEXT NOT NULL DEFAULT 'pairs',
    "level" TEXT NOT NULL DEFAULT 'intermediate',
    "price" INTEGER,
    "scoringMode" TEXT NOT NULL DEFAULT 'sets',
    "totalRounds" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_tournament" ("createdAt", "date", "format", "id", "level", "location", "name", "participantMode", "price", "scoringMode", "size", "status", "totalRounds") SELECT "createdAt", "date", "format", "id", "level", "location", "name", "participantMode", "price", "scoringMode", "size", "status", "totalRounds" FROM "tournament";
DROP TABLE "tournament";
ALTER TABLE "new_tournament" RENAME TO "tournament";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
