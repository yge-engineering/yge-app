// Submittal — shop drawings / product data / samples sent to the
// engineer for review.
//
// Phase 1 scope: per-job numbered submittals with the status pipeline
// every spec requires:
//   DRAFT → SUBMITTED → RETURNED with one of:
//     APPROVED / APPROVED_AS_NOTED / REVISE_RESUBMIT / REJECTED
//
// Resubmittals get a revision letter (A, B, C). The original number is
// preserved and a `revision` field tracks the round.
//
// What this catches that paper logs miss:
//   - 'Did the engineer return submittal 14 yet?'
//   - 'Are we waiting on anything that's blocking ordering?'
//   - 'When was Rev A returned and why?'

import { z } from 'zod';

export const SubmittalKindSchema = z.enum([
  'SHOP_DRAWING',
  'PRODUCT_DATA',
  'SAMPLE',
  'CERTIFICATE',         // mill certs, COC, weld certs
  'METHOD_STATEMENT',
  'MIX_DESIGN',
  'OPERATIONS_MANUAL',
  'WARRANTY',
  'OTHER',
]);
export type SubmittalKind = z.infer<typeof SubmittalKindSchema>;

export const SubmittalStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'APPROVED_AS_NOTED',
  'REVISE_RESUBMIT',
  'REJECTED',
  'WITHDRAWN',
]);
export type SubmittalStatus = z.infer<typeof SubmittalStatusSchema>;

export const SubmittalSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** Submittal number within the job. e.g. 03 30 00-1 (per spec section)
   *  or 14 (sequential). Free-form to honor the agency's preferred scheme. */
  submittalNumber: z.string().min(1).max(40),
  /** Revision letter for resubmittals. blank = original; A = first resub. */
  revision: z.string().max(4).optional(),

  /** Spec section reference. e.g. '03 30 00 - Cast-in-Place Concrete'. */
  specSection: z.string().max(200).optional(),
  /** Subject / item being submitted. */
  subject: z.string().min(1).max(300),
  kind: SubmittalKindSchema,

  /** Who at YGE sent it. */
  submittedByEmployeeId: z.string().max(60).optional(),
  /** Who we sent it to (engineer / architect / agency rep). */
  submittedTo: z.string().max(200).optional(),

  status: SubmittalStatusSchema.default('DRAFT'),
  submittedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Calendar deadline by which we need a response (per spec — typically 10
   *  to 14 working days). */
  responseDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  returnedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  /** Engineer's review notes when returned. */
  reviewerNotes: z.string().max(20_000).optional(),

  /** Affects ordering / fabrication when status blocks it. */
  blocksOrdering: z.boolean().default(false),
  /** Lead time on the underlying material — useful when prioritizing
   *  follow-ups. e.g. '6 weeks for custom rebar'. */
  leadTimeNote: z.string().max(500).optional(),

  /** PDF / doc-vault URLs. */
  submittalPdfUrl: z.string().max(800).optional(),
  returnedPdfUrl: z.string().max(800).optional(),

  notes: z.string().max(10_000).optional(),
});
export type Submittal = z.infer<typeof SubmittalSchema>;

export const SubmittalCreateSchema = SubmittalSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: SubmittalStatusSchema.optional(),
  blocksOrdering: z.boolean().optional(),
});
export type SubmittalCreate = z.infer<typeof SubmittalCreateSchema>;

export const SubmittalPatchSchema = SubmittalCreateSchema.partial();
export type SubmittalPatch = z.infer<typeof SubmittalPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function submittalStatusLabel(s: SubmittalStatus): string {
  switch (s) {
    case 'DRAFT': return 'Draft';
    case 'SUBMITTED': return 'Submitted';
    case 'APPROVED': return 'Approved';
    case 'APPROVED_AS_NOTED': return 'Approved as noted';
    case 'REVISE_RESUBMIT': return 'Revise & resubmit';
    case 'REJECTED': return 'Rejected';
    case 'WITHDRAWN': return 'Withdrawn';
  }
}

export function submittalKindLabel(k: SubmittalKind): string {
  switch (k) {
    case 'SHOP_DRAWING': return 'Shop drawing';
    case 'PRODUCT_DATA': return 'Product data';
    case 'SAMPLE': return 'Sample';
    case 'CERTIFICATE': return 'Certificate';
    case 'METHOD_STATEMENT': return 'Method statement';
    case 'MIX_DESIGN': return 'Mix design';
    case 'OPERATIONS_MANUAL': return 'O&M manual';
    case 'WARRANTY': return 'Warranty';
    case 'OTHER': return 'Other';
  }
}

/** Days outstanding since submission. Negative when returned before
 *  due. Undefined when not yet submitted. */
export function submittalDaysOutstanding(
  s: Pick<Submittal, 'submittedAt' | 'returnedAt'>,
  now: Date = new Date(),
): number | undefined {
  if (!s.submittedAt) return undefined;
  const sent = new Date(s.submittedAt + 'T00:00:00');
  if (Number.isNaN(sent.getTime())) return undefined;
  const end = s.returnedAt ? new Date(s.returnedAt + 'T23:59:59') : now;
  return Math.floor((end.getTime() - sent.getTime()) / (24 * 60 * 60 * 1000));
}

export type SubmittalUrgency = 'none' | 'ok' | 'dueSoon' | 'overdue' | 'returned';

export function submittalUrgency(
  s: Pick<Submittal, 'status' | 'responseDueAt' | 'returnedAt'>,
  now: Date = new Date(),
): SubmittalUrgency {
  if (s.returnedAt || ['APPROVED', 'APPROVED_AS_NOTED', 'REVISE_RESUBMIT', 'REJECTED', 'WITHDRAWN'].includes(s.status)) {
    return 'returned';
  }
  if (!s.responseDueAt) return 'none';
  const due = new Date(s.responseDueAt + 'T23:59:59');
  if (Number.isNaN(due.getTime())) return 'none';
  const deltaMs = due.getTime() - now.getTime();
  if (deltaMs < 0) return 'overdue';
  if (deltaMs < 3 * 24 * 60 * 60 * 1000) return 'dueSoon';
  return 'ok';
}

export interface SubmittalRollup {
  total: number;
  open: number;
  approved: number;
  reviseResubmit: number;
  rejected: number;
  overdue: number;
  blocksOrderingOpen: number;
  averageReturnDays: number;
}

export function computeSubmittalRollup(
  submittals: Submittal[],
  now: Date = new Date(),
): SubmittalRollup {
  let open = 0;
  let approved = 0;
  let reviseResubmit = 0;
  let rejected = 0;
  let overdue = 0;
  let blocksOrderingOpen = 0;
  const returnDays: number[] = [];
  for (const s of submittals) {
    if (s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED') {
      approved += 1;
      const d = submittalDaysOutstanding(s);
      if (d !== undefined && d >= 0) returnDays.push(d);
    } else if (s.status === 'REVISE_RESUBMIT') {
      reviseResubmit += 1;
    } else if (s.status === 'REJECTED') {
      rejected += 1;
    } else if (s.status === 'WITHDRAWN') {
      // counted in total only
    } else {
      open += 1;
      if (submittalUrgency(s, now) === 'overdue') overdue += 1;
      if (s.blocksOrdering) blocksOrderingOpen += 1;
    }
  }
  const averageReturnDays =
    returnDays.length > 0
      ? Math.round(
          (returnDays.reduce((a, b) => a + b, 0) / returnDays.length) * 10,
        ) / 10
      : 0;
  return {
    total: submittals.length,
    open,
    approved,
    reviseResubmit,
    rejected,
    overdue,
    blocksOrderingOpen,
    averageReturnDays,
  };
}

export function newSubmittalId(): string {
  // Prefix `subm-` (not `sub-`) avoids collision with SubBid ids.
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `subm-${hex.padStart(8, '0')}`;
}
