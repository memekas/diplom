/*
  Warnings:

  - Added the required column `nickname` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "skillLevel" TEXT
);
INSERT INTO "new_user" ("banExpires", "banReason", "banned", "courtSide", "createdAt", "email", "emailVerified", "id", "image", "name", "phone", "role", "skillLevel", "updatedAt") SELECT "banExpires", "banReason", "banned", "courtSide", "createdAt", "email", "emailVerified", "id", "image", "name", "phone", "role", "skillLevel", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "user_nickname_key" ON "user"("nickname");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
