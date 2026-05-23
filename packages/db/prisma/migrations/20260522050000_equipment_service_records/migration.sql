-- Phase 4: equipment service module — work orders (service records).
-- Tracks open/in-progress/closed work, parts, labor, red-tag flag for
-- safety-critical issues. JSONB-data pattern. Idempotent.
CREATE TABLE IF NOT EXISTS "equipment_service_records" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "redTagged" BOOLEAN NOT NULL DEFAULT false,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "equipment_service_records_companyId_equipmentId_idx"
  ON "equipment_service_records" ("companyId", "equipmentId");
CREATE INDEX IF NOT EXISTS "equipment_service_records_companyId_status_idx"
  ON "equipment_service_records" ("companyId", "status");
CREATE INDEX IF NOT EXISTS "equipment_service_records_companyId_redTagged_idx"
  ON "equipment_service_records" ("companyId", "redTagged");
