-- Phase 2 migration: drop NOT NULL on Job.customerId so file-store
-- jobs (which have no customer link yet) can migrate. Future
-- linking is a UI follow-up. Idempotent for safe re-runs.
ALTER TABLE "jobs" ALTER COLUMN "customerId" DROP NOT NULL;
