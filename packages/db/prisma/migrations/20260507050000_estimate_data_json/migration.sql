-- Phase 2 migration: add nullable data Json column to Estimate so
-- the file-store cutover can stash the full PricedEstimate Zod
-- object (bidItems, subBids, addenda, subLeveling, etc.) without
-- normalizing into BidItem + CostLine rows just yet. Idempotent.
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "data" JSONB;
