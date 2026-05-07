-- Phase 2 migration: add nullable data Json columns to seven structured
-- models so the file-store cutover can stash the full Zod-validated
-- shape without remapping every field.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "data" JSONB;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "data" JSONB;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "data" JSONB;
ALTER TABLE "cost_codes" ADD COLUMN IF NOT EXISTS "data" JSONB;
ALTER TABLE "labor_rates" ADD COLUMN IF NOT EXISTS "data" JSONB;
ALTER TABLE "equipment_rates" ADD COLUMN IF NOT EXISTS "data" JSONB;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "data" JSONB;
