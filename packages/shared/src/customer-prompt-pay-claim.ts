// Per-customer prompt-pay claim potential.
//
// Plain English: California public-works agencies (cities,
// counties, school districts, special districts under PCC
// §20104.50; state agencies under §10261.5) must pay an
// undisputed progress payment within 30 days of receipt. After
// that, the contractor can claim 10% per annum penalty interest
// on the unpaid amount under CCP §685.010(a) — accruing daily
// until paid.
//
// The prompt-pay module already computes per-invoice interest.
// This module rolls it up by customer so Brook can see at a
// glance which agencies have the largest claim potential — the
// statutory leverage available if she wants to push a stuck
// packet.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import { PROMPT_PAY_DAILY_RATE, PROMPT_PAY_DUE_DAYS } from './prompt-pay';

export interface PromptPayInvoiceCell {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  unpaidCents: number;
  daysLate: number;
  accruedInterestCents: number;
}

export interface PromptPayCustomerRow {
  customerName: string;
  invoiceCount: number;
  totalUnpaidCents: number;
  /** Sum of accruedInterestCents across the customer's overdue
   *  invoices — the claim potential. */
  totalAccruedInterestCents: number;
  /** Worst (largest) days-late across the customer's invoices. */
  worstDaysLate: number;
  /** Per-invoice detail, sorted by accrued interest desc. */
  invoices: PromptPayInvoiceCell[];
}

export interface PromptPayRollup {
  customersConsidered: number;
  totalUnpaidCents: number;
  totalAccruedInterestCents: number;
}

export interface PromptPayInputs {
  asOf?: string;
  arInvoices: ArInvoice[];
  /** Annual rate. Defaults to CCP §685.010(a) statutory 10%. */
  annualRate?: number;
  /** Default-30 due window override. */
  promptPayDueDays?: number;
  /** When true (default), case-insensitively merge customer names. */
  caseInsensitive?: boolean;
}

export function buildCustomerPromptPayClaim(
  inputs: PromptPayInputs,
): {
  rollup: PromptPayRollup;
  rows: PromptPayCustomerRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const annual = inputs.annualRate ?? 0.10;
  const dailyRate = inputs.annualRate ? annual / 365 : PROMPT_PAY_DAILY_RATE;
  const dueDays = inputs.promptPayDueDays ?? PROMPT_PAY_DUE_DAYS;
  const caseInsensitive = inputs.caseInsensitive !== false;

  type Bucket = {
    customerName: string;
    invoices: PromptPayInvoiceCell[];
    totalUnpaid: number;
    totalInterest: number;
    worstDaysLate: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (
      inv.status === 'DRAFT' ||
      inv.status === 'PAID' ||
      inv.status === 'WRITTEN_OFF'
    ) continue;
    const unpaid = Math.max(0, inv.totalCents - inv.paidCents);
    if (unpaid <= 0) continue;

    const submittedRaw = inv.sentAt ?? inv.invoiceDate;
    const submitted = parseDate(submittedRaw.slice(0, 10));
    if (!submitted) continue;

    const dueDate = new Date(
      submitted.getTime() + dueDays * 24 * 60 * 60 * 1000,
    );
    const daysLate = daysBetween(dueDate, refNow);
    if (daysLate <= 0) continue; // not yet eligible

    const interest = Math.round(unpaid * dailyRate * daysLate);

    const key = caseInsensitive
      ? inv.customerName.trim().toLowerCase()
      : inv.customerName.trim();
    const b = buckets.get(key) ?? {
      customerName: inv.customerName.trim(),
      invoices: [],
      totalUnpaid: 0,
      totalInterest: 0,
      worstDaysLate: 0,
    };
    b.invoices.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      unpaidCents: unpaid,
      daysLate,
      accruedInterestCents: interest,
    });
    b.totalUnpaid += unpaid;
    b.totalInterest += interest;
    if (daysLate > b.worstDaysLate) b.worstDaysLate = daysLate;
    buckets.set(key, b);
  }

  const rows: PromptPayCustomerRow[] = [];
  let totalUnpaid = 0;
  let totalInterest = 0;
  for (const b of buckets.values()) {
    b.invoices.sort(
      (a, b) => b.accruedInterestCents - a.accruedInterestCents,
    );
    rows.push({
      customerName: b.customerName,
      invoiceCount: b.invoices.length,
      totalUnpaidCents: b.totalUnpaid,
      totalAccruedInterestCents: b.totalInterest,
      worstDaysLate: b.worstDaysLate,
      invoices: b.invoices,
    });
    totalUnpaid += b.totalUnpaid;
    totalInterest += b.totalInterest;
  }

  // Largest claim potential first.
  rows.sort((a, b) => b.totalAccruedInterestCents - a.totalAccruedInterestCents);

  return {
    rollup: {
      customersConsidered: rows.length,
      totalUnpaidCents: totalUnpaid,
      totalAccruedInterestCents: totalInterest,
    },
    rows,
  };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
