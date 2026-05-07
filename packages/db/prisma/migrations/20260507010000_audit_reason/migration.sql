-- Phase 2 migration: AuditEvent gains a `reason` text column for
-- the file-store cutover. Existing rows stay null. Idempotent.
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "reason" TEXT;
