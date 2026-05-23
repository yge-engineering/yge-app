-- Phase 5: fixed asset register — tax-side depreciation tracking,
-- kept separate from operational equipment data. Idempotent.
CREATE TABLE IF NOT EXISTS "fixed_assets" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "equipmentId" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "fixed_assets_companyId_category_idx"
  ON "fixed_assets" ("companyId", "category");
CREATE INDEX IF NOT EXISTS "fixed_assets_companyId_equipmentId_idx"
  ON "fixed_assets" ("companyId", "equipmentId");
