-- Phase 2 migration: Equipment table for the equipment-store cutover.
-- Idempotent so a re-run after a manual apply is harmless.
CREATE TABLE IF NOT EXISTS "equipment_assets" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "assignedJobId" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "equipment_assets_companyId_status_idx"
  ON "equipment_assets" ("companyId", "status");
CREATE INDEX IF NOT EXISTS "equipment_assets_companyId_assignedJobId_idx"
  ON "equipment_assets" ("companyId", "assignedJobId");
