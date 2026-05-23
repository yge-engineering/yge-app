-- Phase 1: PDF plan editor — per-PDF takeoffs (scale calibration + measurements).
-- Same JSONB-data pattern as photos / equipment_inspections: the full Zod-parsed
-- record lives in one column, with a few promoted columns for indexed lookups
-- (jobId, bidId, planRef so we can list takeoffs for a job / bid / specific PDF).
-- Idempotent.
CREATE TABLE IF NOT EXISTS "plan_takeoffs" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "jobId" TEXT,
  "bidId" TEXT,
  "planRef" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "plan_takeoffs_companyId_jobId_idx"
  ON "plan_takeoffs" ("companyId", "jobId");
CREATE INDEX IF NOT EXISTS "plan_takeoffs_companyId_bidId_idx"
  ON "plan_takeoffs" ("companyId", "bidId");
CREATE INDEX IF NOT EXISTS "plan_takeoffs_companyId_planRef_idx"
  ON "plan_takeoffs" ("companyId", "planRef");
