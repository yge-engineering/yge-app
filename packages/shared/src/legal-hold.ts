// Legal hold — freeze the records on a job (or other entity) the
// moment a hold is applied so the records-retention engine can't
// purge them.
//
// Project plan v6.2: 'records retention + legal hold engine that
// ... freezes every record on a job the moment a hold is applied
// with full preservation-notice automation and certificates of
// destruction'.
//
// Applies to: a Job, a Customer dispute, an Employee claim, an
// Incident, or any other top-level entity whose subordinate
// records (CPRs, daily reports, photos, COs) all need to stay
// intact during the hold period.

import { z } from 'zod';
import { AuditEntityTypeSchema } from './audit';

export const LegalHoldStatusSchema = z.enum([
  'ACTIVE',
  'RELEASED', // hold lifted; records can be purged again
  'EXPIRED',  // a defined end date that's now past
]);
export type LegalHoldStatus = z.infer<typeof LegalHoldStatusSchema>;

export const LegalHoldReasonSchema = z.enum([
  'AGENCY_AUDIT',
  'IRS_AUDIT',
  'WORKERS_COMP_AUDIT',
  'PAGA_CLAIM',
  'WAGE_HOUR_CLAIM',
  'CONTRACT_DISPUTE',
  'CONSTRUCTION_DEFECT',
  'WARRANTY_CLAIM',
  'INTERNAL_INVESTIGATION',
  'OTHER',
]);
export type LegalHoldReason = z.infer<typeof LegalHoldReasonSchema>;

export const LegalHoldSchema = z.object({
  /** Stable id `hold-<8hex>`. */
  id: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Tenant scope. */
  companyId: z.string().min(1).max(120),

  status: LegalHoldStatusSchema.default('ACTIVE'),
  reason: LegalHoldReasonSchema,

  /** Plain-English title shown on the hold dashboard ('IRS audit
   *  for tax year 2024', 'Sulphur Springs delay claim'). */
  title: z.string().min(1).max(200),
  /** Longer description / matter summary. */
  description: z.string().max(8000).optional(),

  /** Top-level entities the hold attaches to. Subordinate records
   *  (e.g. every CPR / daily report / change order / photo on a
   *  held Job) inherit the hold automatically when the resolver
   *  walks the relations.
   *
   *  Specify at least one. Multiple is supported when one matter
   *  spans several jobs / employees / customers. */
  entities: z.array(z.object({
    entityType: AuditEntityTypeSchema,
    entityId: z.string().min(1).max(120),
  })).min(1),

  /** Date the matter began (the 'event' that triggered the hold).
   *  yyyy-mm-dd. */
  matterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Optional pre-set end date — when the hold should auto-release.
   *  Leave blank when the duration is open-ended (typical for
   *  claims / disputes); set when known (e.g. an audit window). */
  expectedReleaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  /** Filled when the hold is released. */
  releasedAt: z.string().optional(),
  releasedByUserId: z.string().max(120).optional(),
  releasedReason: z.string().max(2000).optional(),

  /** Outside counsel / agency contact + matter number for traceability. */
  matterNumber: z.string().max(120).optional(),
  counselContact: z.string().max(400).optional(),

  /** Internal notes — not auto-included in preservation notices. */
  notes: z.string().max(8000).optional(),
});
export type LegalHold = z.infer<typeof LegalHoldSchema>;

export const LegalHoldCreateSchema = LegalHoldSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: LegalHoldStatusSchema.optional(),
});
export type LegalHoldCreate = z.infer<typeof LegalHoldCreateSchema>;

// ---- Helpers ------------------------------------------------------------

export function newLegalHoldId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `hold-${hex.padStart(8, '0')}`;
}

/** Whether a hold is still freezing records as of `asOf`. */
export function isHoldActive(hold: LegalHold, asOf: string = new Date().toISOString().slice(0, 10)): boolean {
  if (hold.status !== 'ACTIVE') return false;
  if (hold.expectedReleaseDate && asOf > hold.expectedReleaseDate) return false;
  return true;
}

/**
 * Whether a particular entity is frozen by any active hold. The
 * caller passes the full holds list; this helper does the
 * intersection. Future versions can walk the entity-relation graph
 * (Job -> CertifiedPayroll, Job -> ChangeOrder, etc.) so a single
 * hold on a Job freezes every subordinate record automatically;
 * that walker is a route-layer concern + lives there.
 */
export function isEntityFrozen(
  holds: LegalHold[],
  entityType: string,
  entityId: string,
  asOf: string = new Date().toISOString().slice(0, 10),
): boolean {
  for (const h of holds) {
    if (!isHoldActive(h, asOf)) continue;
    for (const e of h.entities) {
      if (e.entityType === entityType && e.entityId === entityId) return true;
    }
  }
  return false;
}

export interface LegalHoldRollup {
  total: number;
  byStatus: Record<LegalHoldStatus, number>;
  /** Holds where matterDate is more than 1 year ago + still ACTIVE
   *  — usually the long-running ones the operator wants to revisit. */
  staleActiveCount: number;
}

export function computeLegalHoldRollup(holds: LegalHold[]): LegalHoldRollup {
  const byStatus: Record<LegalHoldStatus, number> = {
    ACTIVE: 0, RELEASED: 0, EXPIRED: 0,
  };
  let staleActiveCount = 0;
  const oneYearAgo = new Date();
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);
  for (const h of holds) {
    byStatus[h.status] += 1;
    if (h.status === 'ACTIVE' && h.matterDate < cutoff) staleActiveCount += 1;
  }
  return { total: holds.length, byStatus, staleActiveCount };
}
