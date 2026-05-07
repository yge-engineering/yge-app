-- Phase 2 migration: DirRateProposal table for the dir-rate-sync
-- cutover. Idempotent so a re-run is harmless.
CREATE TABLE IF NOT EXISTS "dir_rate_proposals" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "syncRunId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "county" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "dir_rate_proposals_companyId_syncRunId_idx"
  ON "dir_rate_proposals" ("companyId", "syncRunId");
CREATE INDEX IF NOT EXISTS "dir_rate_proposals_companyId_status_idx"
  ON "dir_rate_proposals" ("companyId", "status");
