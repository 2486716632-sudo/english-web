-- AlterTable
ALTER TABLE "Word" ADD COLUMN "collocations" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WordReview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordId" INTEGER NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "easiness" REAL NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" DATETIME,
    "isMastered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WordReview_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WordReview" ("createdAt", "easiness", "id", "interval", "lastReviewedAt", "nextReviewAt", "repetitions", "updatedAt", "wordId") SELECT "createdAt", "easiness", "id", "interval", "lastReviewedAt", "nextReviewAt", "repetitions", "updatedAt", "wordId" FROM "WordReview";
DROP TABLE "WordReview";
ALTER TABLE "new_WordReview" RENAME TO "WordReview";
CREATE UNIQUE INDEX "WordReview_wordId_key" ON "WordReview"("wordId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
