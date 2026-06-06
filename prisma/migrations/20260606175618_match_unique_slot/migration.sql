-- CreateIndex
CREATE UNIQUE INDEX "match_tournamentId_round_position_key" ON "match"("tournamentId", "round", "position");

