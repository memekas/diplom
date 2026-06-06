-- CreateTable
CREATE TABLE "pair" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT NOT NULL,
    "seed" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pair_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pair_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pair_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "pair_tournamentId_player1Id_key" ON "pair"("tournamentId", "player1Id");

-- CreateIndex
CREATE UNIQUE INDEX "pair_tournamentId_player2Id_key" ON "pair"("tournamentId", "player2Id");
