-- AlterTable
ALTER TABLE "match" ADD COLUMN "setsWonA" INTEGER;
ALTER TABLE "match" ADD COLUMN "setsWonB" INTEGER;

-- CreateTable
CREATE TABLE "set_score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "gamesPair1" INTEGER NOT NULL,
    "gamesPair2" INTEGER NOT NULL,
    CONSTRAINT "set_score_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "set_score_matchId_setNumber_key" ON "set_score"("matchId", "setNumber");
