// Records-retention purge batch — operator confirmation record.
//
// When the dry-run report identifies eligible-and-not-frozen rows
// for a given rule + entity bucket, the operator confirms (with a
// plain-English reason) and the API records a RetentionPurgeBatch.
// The batch is the durable proof — for the auditor, the lawyer, and
// future-us — that the destruction was authorized, by whom, against
// which records, citing which authority, on what date.
//
// Phase 1 design intent: the batch records the operator's *decision*.
// The actual byte-level deletion from each underlying store is a
// per-store delete pass that lands in a follow-up bundle. We never
// want a button on a UI that wipes records before the audit row +
// batch row are durably persisted.

import { z } from 'zod';
import { AuditEntityTypeSchema } from './audit';

export const RetentionPurgeBatchRowSchema = z.object({
  entityId: z.string().min(1).max(120),
  /** Plain-English label captured at confirm-time so the batch
   *  remains readable even after the underlying record is purged. */
  label: z.string().max(400),
  /** ISO date the retention clock started for this row. */
  triggerDateIso: z.string(),
  /** yyyy-mm-dd this row first became purge-eligible. */
  purgeEligibleOn: z.string(),
});
export type RetentionPurgeBatchRow = z.infer<typeof RetentionPurgeBatchRowSchema>;

export const RetentionPurgeBatchSchema = z.object({
  /** Stable id `purge-<8hex>`. */
  id: z.string().min(1).max(80),
  createdAt: z.string(),

  /** Tenant scope. */
  companyId: z.string().min(1).max(120),

  /** Bucket the purge ran against. One rule -> one entityType. */
  entityType: AuditEntityTypeSchema,

  /** Rule snapshot — copied at confirm-time so we can prove which
   *  rule justified this destruction even if the rule table later
   *  changes. */
  ruleLabel: z.string().min(1).max(200),
  ruleAuthority: z.string().min(1).max(60),
  ruleCitation: z.string().min(1).max(400),
  retainYears: z.number().int().min(0).max(60),

  /** As-of date the eligibility was evaluated. */
  asOfIso: z.string(),

  /** Operator who confirmed. Null for system-driven scheduled
   *  purges (none today; reserved for the recurring-job phase). */
  operatorUserId: z.string().max(120).nullable(),

  /** Required plain-English justification — what the operator
   *  reviewed, why the bucket is safe to clear. The auditor reads
   *  this. 'Reviewed AP invoices from 2018; 7-year IRS window
   *  cleared 2025-12; no active disputes per Brook.' */
  operatorReason: z.string().min(1).max(4000),

  /** Rows the batch covered. Snapshot only — the underlying records
   *  may be gone by the time someone reads this row. */
  rows: z.array(RetentionPurgeBatchRowSchema).min(1),

  /** Phase-1 marker. False = batch records the operator decision +
   *  per-row audit entries; the byte-level deletion is deferred to
   *  the per-store delete pass. True = the deletion has actually
   *  happened (post-bundle, when stores grow purgeRecord methods). */
  bytesDeleted: z.boolean().default(false),
});
export type RetentionPurgeBatch = z.infer<typeof RetentionPurgeBatchSchema>;

export const RetentionPurgeBatchCreateSchema = z.object({
  entityType: AuditEntityTypeSchema,
  /** entityIds of rows the operator confirmed. The store re-checks
   *  each is still eligible + not frozen at apply-time. */
  entityIds: z.array(z.string().min(1).max(120)).min(1).max(500),
  operatorReason: z.string().min(1).max(4000),
  operatorUserId: z.string().max(120).optional(),
});
export type RetentionPurgeBatchCreate = z.infer<typeof RetentionPurgeBatchCreateSchema>;

export function newRetentionPurgeBatchId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `purge-${hex.padStart(8, '0')}`;
}

/** Result of attempting to confirm a purge batch — surfaces both
 *  the batch (when written) and the rows that the apply-time
 *  re-check rejected (so the UI can tell the operator). */
export interface RetentionPurgeConfirmResult {
  batch: RetentionPurgeBatch | null;
  /** Rows the operator submitted but the apply-time check found
   *  not eligible (clock not yet up, or contextual block). */
  rejectedNotEligible: string[];
  /** Rows now frozen by an active hold (added between dry-run and
   *  confirm). These get blocked even if the operator selected
   *  them. */
  rejectedFrozen: string[];
  /** Rows the dry-run report didn't have for this rule (typo / id
   *  drift) — we never invent rows the report can't justify. */
  rejectedUnknown: string[];
}
