-- Phase 2: equipment inspections — pre-shift / periodic safety checks of
-- heavy equipment (excavators, dozers, trucks). Backs the DOT / Cal-OSHA /
-- YGE Equipment Maintenance Plan paper trail. Same JSONB-data pattern as
-- the photos table: full Zod-parsed record in one column, with a couple of
-- promoted columns for indexed lookups (equipmentId, outOfService).
-- Idempotent.
CREATE TABLE IF NOT EXISTS "equipment_inspections" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "outOfService" BOOLEAN NOT NULL DEFAULT false,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "equipment_inspections_companyId_equipmentId_idx"
  ON "equipment_inspections" ("companyId", "equipmentId");
CREATE INDEX IF NOT EXISTS "equipment_inspections_companyId_outOfService_idx"
  ON "equipment_inspections" ("companyId", "outOfService");
