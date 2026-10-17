-- AlterTable
-- Adds the vehicle category and the publication flag used to hide vehicles
-- from the public website. Additive and non-destructive: existing rows keep
-- their data and default to published so the current public listings are
-- preserved.
ALTER TABLE "Car" ADD COLUMN "category" TEXT,
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Car_isPublished_idx" ON "Car"("isPublished");
