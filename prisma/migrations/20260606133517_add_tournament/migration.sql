-- CreateTable
CREATE TABLE "tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registration',
    "date" DATETIME,
    "location" TEXT,
    "setsPerMatch" INTEGER NOT NULL DEFAULT 3,
    "gamesPerSet" INTEGER NOT NULL DEFAULT 6,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
