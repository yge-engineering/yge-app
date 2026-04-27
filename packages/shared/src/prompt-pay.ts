// CA Prompt Payment Act — penalty interest on overdue progress
// payments and overdue retention release.
//
// Plain English what this is for:
//
//   When a public agency in California (city, county, school district,
//   special district) gets an undisputed progress-payment request from
//   the prime, they must pay within 30 days. If they don't, they owe
//   the contractor penalty interest at the legal rate (10% per annum
//   under Code of Civil Procedure §685.010(a)) on the unpaid amount,
//   accruing daily until paid. That's PCC §20104.50 for local
//   agencies, with PCC §10261.5 carrying the same rule for state
//   agencies (Caltrans, DGS).
//
//   For final retention release, the rule is different: §7107 gives
//   the agency 60 days from completion notice, and statutory interest
//   is 2% per month — that one is already in ar-payment.ts as
//   `ca7107RetentionInterest` and we re-export the binding here.
//
// Why YGE cares: Cal Fire and Caltrans are good payers. County and
// city agencies are not. Tracking the legal demand we COULD make if
// we wanted to push gives Brook leverage on a stuck packet, and shows
// us the dollar cost of letting collections slide.
//
// This module is a pure derivation — no new persisted records. It
// reads existing AR invoices + AR payments and a "submitted-on" date
// (defaults to invoice.sentAt or invoiceDate if missing) and reports
// per-invoice penalty interest accrued through `asOf`.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

/** §20104.50 / §10261.5 — public agency must pay an undisputed
 *  progress payment within 30 days of receipt. */
export const PROMPT_PAY_DUE_DAYS = 30;

/** Code of Civil Procedure §685.010(a) — legal rate is 10% per annum. */
export const PROMPT_PAY_ANNUAL_RATE = 0.1;

/** Per-day rate the report applies. We use 365 days flat (the
 *  statute says "per annum" without specifying compounding or
 *  day-count convention; flat 365 matches how the AGs typically
 *  brief these claims). */
export const PROMPT_PAY_DAILY_RATE = PROMPT_PAY_ANNUAL_RATE / 365;

export interface PromptPayInterestInputs {
  /** Date the agency received the undisputed payment request, yyyy-mm-dd. */
  submittedOn: string;
  /** Date payment cleared, yyyy-mm-dd. Omit to compute "if paid today". */
  paidOn?: string;
  /** Amount the agency owed (cents) — typically the unpaid balance
   *  on the invoice when computing accrued interest. */
  unpaidCents: number;
  /** Reference moment for "today" when paidOn is undefined. Defaults
   *  to `new Date()`. */
  now?: Date;
}

export interface PromptPayInterestResult {
  /** submittedOn + 30 days. */
  dueOn: string;
  /** Days past dueOn through paidOn (or now if unpaid). 0 if not late. */
  daysLate: number;
  /** Accrued penalty interest in cents (rounded to nearest cent). */
  interestCents: number;
}

/** Compute §20104.50 / §10261.5 prompt-pay penalty interest on a
 *  single overdue progress payment. */
export function caProgressPaymentInterest(
  inputs: PromptPayInterestInputs,
): PromptPayInterestResult {
  const { submittedOn, paidOn, unpaidCents } = inputs;
  const now = inputs.now ?? new Date();

  const dueDate = addDaysUtc(submittedOn, PROMPT_PAY_DUE_DAYS);
  const dueOn = isoDate(dueDate);
  const endDate = paidOn ? parseDateUtc(paidOn) : now;

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLate = Math.max(
    0,
    Math.floor((endDate.getTime() - dueDate.getTime()) / msPerDay),
  );

  const interestCents = Math.round(
    Math.max(0, unpaidCents) * PROMPT_PAY_DAILY_RATE * daysLate,
  );

  return { dueOn, daysLate, interestCents };
}

// ---- Portfolio report ---------------------------------------------

export interface PromptPayRow {
  invoiceId: string;
  invoiceNumber: string;
  jobId: string;
  customerName: string;
  /** The date used as "submittedOn". sentAt → invoiceDate fallback. */
  submittedOn: string;
  /** True when submittedOn was synthesized from invoiceDate because
   *  sentAt was missing. */
  submittedOnSynthesized: boolean;
  dueOn: string;
  daysLate: number;
  unpaidCents: number;
  interestCents: number;
  /** Convenience: unpaid + interest = full demand if pursuing penalty. */
  totalDemandCents: number;
}

export interface PromptPayReport {
  /** ISO yyyy-mm-dd the report was computed against. */
  asOf: string;
  rows: PromptPayRow[];
  /** Sum across rows. */
  totalUnpaidCents: number;
  totalInterestCents: number;
  totalDemandCents: number;
  /** Just the rows with daysLate > 0. */
  overdueRows: PromptPayRow[];
}

export interface PromptPayReportInputs {
  /** ISO yyyy-mm-dd. */
  asOf: string;
  /** All AR invoices to consider. The report filters internally:
   *  status DRAFT/PAID/WRITTEN_OFF and zero-balance rows are dropped. */
  arInvoices: ArInvoice[];
  /** All AR payments — used to derive the unpaid balance per
   *  invoice when invoice.paidCents is stale. Optional: the report
   *  falls back to invoice.paidCents if not given. */
  arPayments?: ArPayment[];
}

/** Roll up overdue progress-payment penalty interest across every
 *  open AR invoice. Each invoice that's >30 days past its
 *  effective submittedOn contributes its accrued §20104.50 / §10261.5
 *  interest to the totals. */
export function buildPromptPayReport(
  inputs: PromptPayReportInputs,
): PromptPayReport {
  const { asOf, arInvoices, arPayments } = inputs;

  // Index payments by invoice if provided, so we can compute the
  // freshest unpaid balance.
  const paidByInvoice = new Map<string, number>();
  if (arPayments) {
    for (const p of arPayments) {
      paidByInvoice.set(
        p.arInvoiceId,
        (paidByInvoice.get(p.arInvoiceId) ?? 0) + p.amountCents,
      );
    }
  }

  const now = parseDateUtc(asOf);

  const rows: PromptPayRow[] = [];
  for (const inv of arInvoices) {
    if (inv.status === 'DRAFT') continue;
    if (inv.status === 'PAID') continue;
    if (inv.status === 'WRITTEN_OFF') continue;

    const paidCents = paidByInvoice.has(inv.id)
      ? Math.max(inv.paidCents, paidByInvoice.get(inv.id) ?? 0)
      : inv.paidCents;
    const unpaid = Math.max(0, inv.totalCents - paidCents);
    if (unpaid === 0) continue;

    // sentAt is preferred (when the agency actually received it).
    // Fall back to invoiceDate if sentAt is missing — flagged so the
    // UI can surface the assumption.
    const submitted =
      inv.sentAt && /^\d{4}-\d{2}-\d{2}/.test(inv.sentAt)
        ? inv.sentAt.slice(0, 10)
        : inv.invoiceDate;
    const submittedOnSynthesized = !inv.sentAt;

    const calc = caProgressPaymentInterest({
      submittedOn: submitted,
      unpaidCents: unpaid,
      now,
    });

    rows.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      jobId: inv.jobId,
      customerName: inv.customerName,
      submittedOn: submitted,
      submittedOnSynthesized,
      dueOn: calc.dueOn,
      daysLate: calc.daysLate,
      unpaidCents: unpaid,
      interestCents: calc.interestCents,
      totalDemandCents: unpaid + calc.interestCents,
    });
  }

  // Most overdue first — that's where the penalty leverage lives.
  rows.sort((a, b) => b.daysLate - a.daysLate);

  let totalUnpaidCents = 0;
  let totalInterestCents = 0;
  for (const r of rows) {
    totalUnpaidCents += r.unpaidCents;
    totalInterestCents += r.interestCents;
  }

  return {
    asOf,
    rows,
    totalUnpaidCents,
    totalInterestCents,
    totalDemandCents: totalUnpaidCents + totalInterestCents,
    overdueRows: rows.filter((r) => r.daysLate > 0),
  };
}

// ---- Helpers (UTC) ------------------------------------------------

function parseDateUtc(yyyymmdd: string): Date {
  return new Date(`${yyyymmdd}T00:00:00Z`);
}

function addDaysUtc(yyyymmdd: string, days: number): Date {
  const t = parseDateUtc(yyyymmdd).getTime();
  return new Date(t + days * 24 * 60 * 60 * 1000);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Note: §7107 retention-release interest is in ar-payment.ts as
// `ca7107RetentionInterest`. We do NOT re-export it here because the
// barrel index.ts already exposes both via `export *`.
