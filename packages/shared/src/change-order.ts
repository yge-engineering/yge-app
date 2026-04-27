// Change order — modification to the awarded contract.
//
// Scope, cost, or schedule changes that the agency formally approves.
// CO numbers are sequential per job (CO-01, CO-02, ...). Each CO has
// added work + deducted work line items (most agencies require both
// shown when the CO is partially a deduct).
//
// Status pipeline:
//   PROPOSED → AGENCY_REVIEW → APPROVED | REJECTED → EXECUTED
//
// Link-back fields (originRfiId, originDailyReportId) trace the
// paper trail from "the engineer answered this differently than the
// plan said" → "we issued an RFI about it" → "the RFI got an answer
// that costs more" → "this CO captures the cost".

import { z } from 'zod';

export const ChangeOrderStatusSchema = z.enum([
  'PROPOSED',
  'AGENCY_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'WITHDRAWN',
]);
export type ChangeOrderStatus = z.infer<typeof ChangeOrderStatusSchema>;

export const ChangeOrderReasonSchema = z.enum([
  'OWNER_DIRECTED',
  'DIFFERING_SITE_CONDITION',
  'DESIGN_REVISION',
  'RFI_RESPONSE',
  'CODE_REVISION',
  'WEATHER_OR_DELAY',
  'SCOPE_CLARIFICATION',
  'OTHER',
]);
export type ChangeOrderReason = z.infer<typeof ChangeOrderReasonSchema>;

export const ChangeOrderLineItemSchema = z.object({
  /** Free-form description of the added or deducted work. */
  description: z.string().min(1).max(400),
  /** Positive cents = added scope; negative = deducted. */
  amountCents: z.number().int(),
  /** Free-form unit of measure. */
  unit: z.string().max(20).optional(),
  quantity: z.number().nonnegative().optional(),
  unitPriceCents: z.number().int().optional(),
  /** Optional schedule impact in days. Positive = extension; negative =
   *  acceleration. */
  scheduleDays: z.number().int().optional(),
});
export type ChangeOrderLineItem = z.infer<typeof ChangeOrderLineItemSchema>;

export const ChangeOrderSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** CO number on the job. Free-form ('CO-01', '1', etc). */
  changeOrderNumber: z.string().min(1).max(40),

  /** One-line subject. */
  subject: z.string().min(1).max(300),
  /** Full description of the change. */
  description: z.string().max(20_000).default(''),
  reason: ChangeOrderReasonSchema.default('OWNER_DIRECTED'),

  /** Originating RFI when the CO traces back to one. */
  originRfiId: z.string().max(120).optional(),
  /** Originating daily report (for differing-site-condition COs). */
  originDailyReportId: z.string().max(120).optional(),

  status: ChangeOrderStatusSchema.default('PROPOSED'),
  proposedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  approvedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  executedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  /** Line item breakdown of cost impact. */
  lineItems: z.array(ChangeOrderLineItemSchema).default([]),
  /** Total cost impact in cents. Computed from line items but stored so
   *  the list view doesn't have to scan lines. Negative = deduct. */
  totalCostImpactCents: z.number().int().default(0),
  /** Total schedule impact in days. Positive = extension. */
  totalScheduleImpactDays: z.number().int().default(0),

  /** New contract amount after this CO is executed. Captured at
   *  approval time so the CO log doubles as a contract-amount audit
   *  trail. */
  newContractAmountCents: z.number().int().nonnegative().optional(),
  /** New contract completion date. */
  newCompletionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  /** PDFs of the proposed CO (CCO/PCO submitted by us) and the executed
   *  CO returned by the agency. */
  proposalPdfUrl: z.string().max(800).optional(),
  executedPdfUrl: z.string().max(800).optional(),

  notes: z.string().max(10_000).optional(),
});
export type ChangeOrder = z.infer<typeof ChangeOrderSchema>;

export const ChangeOrderCreateSchema = ChangeOrderSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: ChangeOrderStatusSchema.optional(),
  reason: ChangeOrderReasonSchema.optional(),
  description: z.string().max(20_000).optional(),
  lineItems: z.array(ChangeOrderLineItemSchema).optional(),
  totalCostImpactCents: z.number().int().optional(),
  totalScheduleImpactDays: z.number().int().optional(),
});
export type ChangeOrderCreate = z.infer<typeof ChangeOrderCreateSchema>;

export const ChangeOrderPatchSchema = ChangeOrderCreateSchema.partial();
export type ChangeOrderPatch = z.infer<typeof ChangeOrderPatchSchema>;

// ---- Pure helpers --------------------------------------------------------

export function changeOrderStatusLabel(s: ChangeOrderStatus): string {
  switch (s) {
    case 'PROPOSED': return 'Proposed';
    case 'AGENCY_REVIEW': return 'Agency review';
    case 'APPROVED': return 'Approved';
    case 'REJECTED': return 'Rejected';
    case 'EXECUTED': return 'Executed';
    case 'WITHDRAWN': return 'Withdrawn';
  }
}

export function changeOrderReasonLabel(r: ChangeOrderReason): string {
  switch (r) {
    case 'OWNER_DIRECTED': return 'Owner-directed';
    case 'DIFFERING_SITE_CONDITION': return 'Differing site condition';
    case 'DESIGN_REVISION': return 'Design revision';
    case 'RFI_RESPONSE': return 'RFI response';
    case 'CODE_REVISION': return 'Code revision';
    case 'WEATHER_OR_DELAY': return 'Weather / delay';
    case 'SCOPE_CLARIFICATION': return 'Scope clarification';
    case 'OTHER': return 'Other';
  }
}

/** Recompute totals from line items. */
export function recomputeChangeOrderTotals(lineItems: ChangeOrderLineItem[]): {
  totalCostImpactCents: number;
  totalScheduleImpactDays: number;
} {
  let cost = 0;
  let days = 0;
  for (const li of lineItems) {
    cost += li.amountCents;
    if (li.scheduleDays !== undefined) days += li.scheduleDays;
  }
  return { totalCostImpactCents: cost, totalScheduleImpactDays: days };
}

export interface ChangeOrderRollup {
  total: number;
  proposed: number;
  underReview: number;
  approved: number;
  rejected: number;
  executed: number;
  totalApprovedAddCents: number;
  totalApprovedDeductCents: number;
  totalApprovedDays: number;
}

export function computeChangeOrderRollup(orders: ChangeOrder[]): ChangeOrderRollup {
  let proposed = 0;
  let underReview = 0;
  let approved = 0;
  let rejected = 0;
  let executed = 0;
  let totalApprovedAddCents = 0;
  let totalApprovedDeductCents = 0;
  let totalApprovedDays = 0;
  for (const o of orders) {
    switch (o.status) {
      case 'PROPOSED': proposed += 1; break;
      case 'AGENCY_REVIEW': underReview += 1; break;
      case 'APPROVED': approved += 1; break;
      case 'REJECTED': rejected += 1; break;
      case 'EXECUTED': executed += 1; break;
      case 'WITHDRAWN': break;
    }
    if (o.status === 'APPROVED' || o.status === 'EXECUTED') {
      if (o.totalCostImpactCents > 0) totalApprovedAddCents += o.totalCostImpactCents;
      else totalApprovedDeductCents += -o.totalCostImpactCents;
      totalApprovedDays += o.totalScheduleImpactDays;
    }
  }
  return {
    total: orders.length,
    proposed,
    underReview,
    approved,
    rejected,
    executed,
    totalApprovedAddCents,
    totalApprovedDeductCents,
    totalApprovedDays,
  };
}

export function newChangeOrderId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `co-${hex.padStart(8, '0')}`;
}
