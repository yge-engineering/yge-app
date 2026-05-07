-- Phase 2 observability: capture unhandled errors into a Postgres
-- table so the office can count them, group them, and find a
-- specific request by its X-Request-Id header. Idempotent.
CREATE TABLE IF NOT EXISTS "api_errors" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT,
  "requestId" TEXT,
  "method" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "stack" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "api_errors_companyId_occurredAt_idx"
  ON "api_errors" ("companyId", "occurredAt");
CREATE INDEX IF NOT EXISTS "api_errors_statusCode_occurredAt_idx"
  ON "api_errors" ("statusCode", "occurredAt");
