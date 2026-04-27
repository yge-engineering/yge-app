// Lien-waiver chase list.
//
// Plain English: every progress + final payment YGE receives on a
// public-works job needs a corresponding statutory lien waiver
// (Civil Code §8132 / §8134 / §8136 / §8138) sent back to the GC
// or owner. If we don't deliver the waiver, future payments stop
// flowing — the GC won't release the next draw without it.
//
// This walks AR payments + lien waivers and surfaces:
//   - Payments received with no waiver linked yet (need to draft)
//   - Waivers in DRAFT or SIGNED but not yet DELIVERED
//   - Conditional waivers paired with payments that have actually
//     cleared (we should now send the matching unconditional)
//
// Pure derivation. No persisted records.

import type { ArPayment } from './ar-payment';
import type { LienWaiver, LienWaiverKind } from './lien-waiver';

export type WaiverChaseReason =
  | 'NO_WAIVER_DRAFTED'
  | 'WAIVER_DRAFT_NOT_SIGNED'
  | 'WAIVER_SIGNED_NOT_DELIVERED'
  | 'CONDITIONAL_PAID_NEEDS_UNCONDITIONAL';

export interface WaiverChaseRow {
  paymentId: string;
  jobId: string;
  arInvoiceId: string;
  receivedOn: string;
  paymentKind: ArPayment['kind'];
  amountCents: number;
  /** Existing waiver id when one already exists for this payment. */
  existingWaiverId?: string;
  /** Waiver status when existingWaiverId is set. */
  existingWaiverStatus?: LienWaiver['status'];
  /** Whether the existing waiver is conditional. */
  existingWaiverIsConditional?: boolean;

  reason: WaiverChaseReason;
  /** Days since the payment was received. */
  daysSincePayment: number;
}

export interface LienWaiverChaseRollup {
  total: number;
  noWaiver: number;
  draft: number;
  signedNotDelivered: number;
  conditionalNeedsUnconditional: number;
}

export interface LienWaiverChaseInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  arPayments: ArPayment[];
  lienWaivers: LienWaiver[];
}

export function buildLienWaiverChase(inputs: LienWaiverChaseInputs): {
  rows: WaiverChaseRow[];
  rollup: LienWaiverChaseRollup;
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  // Index waivers by arPaymentId AND by arInvoiceId (some waivers
  // reference the invoice, not the payment).
  const byPaymentId = new Map<string, LienWaiver[]>();
  const byInvoiceId = new Map<string, LienWaiver[]>();
  for (const w of inputs.lienWaivers) {
    if (w.status === 'VOIDED') continue;
    if (w.arPaymentId) {
      const list = byPaymentId.get(w.arPaymentId) ?? [];
      list.push(w);
      byPaymentId.set(w.arPaymentId, list);
    } else if (w.arInvoiceId) {
      const list = byInvoiceId.get(w.arInvoiceId) ?? [];
      list.push(w);
      byInvoiceId.set(w.arInvoiceId, list);
    }
  }

  const rows: WaiverChaseRow[] = [];
  for (const p of inputs.arPayments) {
    const candidates = [
      ...(byPaymentId.get(p.id) ?? []),
      ...(byInvoiceId.get(p.arInvoiceId) ?? []),
    ];

    if (candidates.length === 0) {
      rows.push({
        paymentId: p.id,
        jobId: p.jobId,
        arInvoiceId: p.arInvoiceId,
        receivedOn: p.receivedOn,
        paymentKind: p.kind,
        amountCents: p.amountCents,
        reason: 'NO_WAIVER_DRAFTED',
        daysSincePayment: Math.max(
          0,
          daysBetween(p.receivedOn, asOf),
        ),
      });
      continue;
    }

    // Pick the most recent waiver as "the" one to track.
    const sorted = candidates.sort((a, b) =>
      (b.signedOn ?? b.createdAt).localeCompare(a.signedOn ?? a.createdAt),
    );
    const w = sorted[0]!;
    const isConditional =
      w.kind === 'CONDITIONAL_PROGRESS' || w.kind === 'CONDITIONAL_FINAL';
    const matchingUnconditional = unconditionalCounterpart(w.kind);

    let reason: WaiverChaseReason | null = null;
    if (w.status === 'DRAFT') reason = 'WAIVER_DRAFT_NOT_SIGNED';
    else if (w.status === 'SIGNED') reason = 'WAIVER_SIGNED_NOT_DELIVERED';
    else if (
      w.status === 'DELIVERED' &&
      isConditional &&
      // Has a matching unconditional already been delivered?
      !candidates.some(
        (c) => c.kind === matchingUnconditional && c.status === 'DELIVERED',
      )
    ) {
      reason = 'CONDITIONAL_PAID_NEEDS_UNCONDITIONAL';
    }

    if (!reason) continue;

    rows.push({
      paymentId: p.id,
      jobId: p.jobId,
      arInvoiceId: p.arInvoiceId,
      receivedOn: p.receivedOn,
      paymentKind: p.kind,
      amountCents: p.amountCents,
      existingWaiverId: w.id,
      existingWaiverStatus: w.status,
      existingWaiverIsConditional: isConditional,
      reason,
      daysSincePayment: Math.max(0, daysBetween(p.receivedOn, asOf)),
    });
  }

  // Worst first: oldest unaddressed payment.
  rows.sort((a, b) => b.daysSincePayment - a.daysSincePayment);

  let noWaiver = 0;
  let draft = 0;
  let signedNotDelivered = 0;
  let conditionalNeedsUnconditional = 0;
  for (const r of rows) {
    if (r.reason === 'NO_WAIVER_DRAFTED') noWaiver += 1;
    else if (r.reason === 'WAIVER_DRAFT_NOT_SIGNED') draft += 1;
    else if (r.reason === 'WAIVER_SIGNED_NOT_DELIVERED') signedNotDelivered += 1;
    else conditionalNeedsUnconditional += 1;
  }

  return {
    rows,
    rollup: {
      total: rows.length,
      noWaiver,
      draft,
      signedNotDelivered,
      conditionalNeedsUnconditional,
    },
  };
}

function unconditionalCounterpart(kind: LienWaiverKind): LienWaiverKind {
  if (kind === 'CONDITIONAL_PROGRESS') return 'UNCONDITIONAL_PROGRESS';
  if (kind === 'CONDITIONAL_FINAL') return 'UNCONDITIONAL_FINAL';
  // Already unconditional — return self.
  return kind;
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
