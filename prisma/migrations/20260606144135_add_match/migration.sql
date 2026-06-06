-- CreateTable
CREATE TABLE "match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "pairAId" TEXT,
    "pairBId" TEXT,
    "winnerId" TEXT,
    "nextMatchId" TEXT,
    "nextSlot" TEXT,
    CONSTRAINT "match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_pairAId_fkey" FOREIGN KEY ("pairAId") REFERENCES "pair" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "match_pairBId_fkey" FOREIGN KEY ("pairBId") REFERENCES "pair" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "pair" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "match_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "match" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "match_tournamentId_round_idx" ON "match"("tournamentId", "round");
