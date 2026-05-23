-- Phase 4: Job Safety Analysis (JSA) module — per-shift hazard analysis.
-- JSONB-data pattern; promoted columns for jobId + workDate so the office
-- can pull "every JSA for job X" or "every JSA on date D" quickly.
-- Idempotent.
CREATE TABLE IF NOT EXISTS "jsas" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "workDate" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "jsas_companyId_jobId_idx"
  ON "jsas" ("companyId", "jobId");
CREATE INDEX IF NOT EXISTS "jsas_companyId_workDate_idx"
  ON "jsas" ("companyId", "workDate");
