// AR collection sequence — rule engine that picks the next dunning
// action for an aged AR invoice.
//
// Plain English: an invoice goes out, customer doesn't pay. After 30
// days we should call them. After 45, send a polite email reminder.
// After 60, preserve our lien rights (preliminary notice if not yet
// filed). After 90, a demand letter. After 120, talk to the lawyer.
//
// This module is pure inputs → recommendation. The follow-up sender
// (email/phone log) lives elsewhere — this just decides what's next.
// Brook uses the rec to drive a Monday-morning collection meeting:
// sort by recommended action, work the highest-stakes ones first.

import type { CalDate } from './california-holidays';

/** Action steps in order of escalation. */
export type ArCollectionAction =
  | 'NONE'
  | 'COURTESY_CALL'
  | 'EMAIL_REMINDER'
  | 'PRELIMINARY_LIEN_NOTICE'
  | 'DEMAND_LETTER'
  | 'STOP_PAYMENT_NOTICE'
  | 'LEGAL_ESCALATION';

export interface ArInvoiceForCollection {
  /** Cents owed today. */
  amountCents: number;
  /** Age in days from the invoice's due date (positive = past due). */
  ageDays: number;
  /** True iff a CA preliminary 20-day notice has already been served on
   *  this job. When false and the project is public-works, the lien
   *  rights clock matters — recommend filing the notice ASAP. */
  preliminaryNoticeServed?: boolean;
  /** True iff we've already sent a demand letter on this invoice.
   *  Skip the demand-letter rec when true. */
  demandLetterSent?: boolean;
  /** True iff a stop-payment notice (CA §9350) is appropriate (public
   *  works only; private jobs use mechanic's lien instead). */
  publicWorks?: boolean;
}

export interface ArCollectionRecommendation {
  action: ArCollectionAction;
  /** One-line plain-English reason for the recommendation, surfaced
   *  in the UI tooltip. */
  reason: string;
  /** Urgency 1-5. 5 = "do today". Drives the sort order on the
   *  morning collections list. */
  urgency: 1 | 2 | 3 | 4 | 5;
}

/** Threshold ages (days past due) for each escalation step. The
 *  defaults reflect Brook's standard cadence; callable callers can
 *  tighten them per customer (e.g. 21/30/45 for a new customer with
 *  no payment history). */
export interface ArSequenceThresholds {
  courtesyCallAt: number;          // default 30
  emailReminderAt: number;         // default 45
  preliminaryNoticeAt: number;     // default 60 (also: 20-day pre-claim rule overrides)
  demandLetterAt: number;          // default 90
  stopPaymentNoticeAt: number;     // default 100 — public works only
  legalEscalationAt: number;       // default 120
}

export const DEFAULT_AR_THRESHOLDS: ArSequenceThresholds = {
  courtesyCallAt: 30,
  emailReminderAt: 45,
  preliminaryNoticeAt: 60,
  demandLetterAt: 90,
  stopPaymentNoticeAt: 100,
  legalEscalationAt: 120,
};

/** Pick the next collection action for an invoice. */
export function recommendArAction(
  invoice: ArInvoiceForCollection,
  thresholds: ArSequenceThresholds = DEFAULT_AR_THRESHOLDS,
): ArCollectionRecommendation {
  const { ageDays, amountCents } = invoice;

  if (ageDays <= 0) {
    return {
      action: 'NONE',
      reason: 'Not yet past due.',
      urgency: 1,
    };
  }

  // Walk thresholds from most-aggressive backwards. The first rule
  // that fires wins — i.e. the most-overdue invoice gets the
  // strongest recommendation appropriate to its state.
  if (ageDays >= thresholds.legalEscalationAt) {
    return {
      action: 'LEGAL_ESCALATION',
      reason: `${ageDays} days past due — escalate to counsel for review.`,
      urgency: 5,
    };
  }

  if (
    ageDays >= thresholds.stopPaymentNoticeAt &&
    invoice.publicWorks === true
  ) {
    return {
      action: 'STOP_PAYMENT_NOTICE',
      reason: `${ageDays} days past due on public-works job — file a stop-payment notice (CA §9350) to preserve rights against undisbursed funds.`,
      urgency: 5,
    };
  }

  if (ageDays >= thresholds.demandLetterAt && !invoice.demandLetterSent) {
    return {
      action: 'DEMAND_LETTER',
      reason: `${ageDays} days past due — send a written demand letter (final notice before legal).`,
      urgency: 4,
    };
  }

  if (
    ageDays >= thresholds.preliminaryNoticeAt &&
    invoice.preliminaryNoticeServed === false
  ) {
    // High urgency — CA lien rights clock is ticking. The 20-day
    // preliminary notice (CC §8200) ideally goes out within 20 days
    // of first furnishing, but a late notice still preserves rights
    // back to 20 days before service.
    return {
      action: 'PRELIMINARY_LIEN_NOTICE',
      reason: `${ageDays} days past due and no preliminary 20-day notice on file — serve one today to preserve mechanic's lien / stop-payment rights.`,
      urgency: 5,
    };
  }

  if (ageDays >= thresholds.emailReminderAt) {
    return {
      action: 'EMAIL_REMINDER',
      reason: `${ageDays} days past due — send a friendly email reminder.`,
      urgency: 3,
    };
  }

  if (ageDays >= thresholds.courtesyCallAt) {
    // Bigger balances bump the urgency one notch.
    const urgency: 2 | 3 = amountCents >= 1_000_000 ? 3 : 2; // ≥ $10k
    return {
      action: 'COURTESY_CALL',
      reason: `${ageDays} days past due — call A/P to confirm receipt and ETA.`,
      urgency,
    };
  }

  return {
    action: 'NONE',
    reason: `${ageDays} days past due — within courtesy window.`,
    urgency: 1,
  };
}

/** Convenience: rank a list of invoices by recommended urgency
 *  (descending) and then by amount (descending). Mutates nothing —
 *  returns a fresh sorted array of {invoice, rec} pairs ready for the
 *  collections morning view. */
export function rankArCollections(
  invoices: ArInvoiceForCollection[],
  thresholds?: ArSequenceThresholds,
): Array<{ invoice: ArInvoiceForCollection; rec: ArCollectionRecommendation }> {
  return invoices
    .map((invoice) => ({ invoice, rec: recommendArAction(invoice, thresholds) }))
    .sort((a, b) => {
      if (a.rec.urgency !== b.rec.urgency) {
        return b.rec.urgency - a.rec.urgency;
      }
      return b.invoice.amountCents - a.invoice.amountCents;
    });
}

// Re-export CalDate for callers that want to use the type but don't
// need the holiday helpers directly.
export type { CalDate };
