// Per-customer first-payment timing.
//
// Plain English: customer-payment-velocity tracks how fast a
// customer fully pays an invoice. This module tracks when they
// START paying — useful for customers who do partial payments
// (Cal Fire pays 90% within 30 days, the retention 60 days
// after completion). The "time to first payment" is what affects
// cash flow most.
//
// Per row: avg days from invoice sentAt to the FIRST received
// AR payment, plus the count of invoices considered, plus a
// median + worst.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface FirstPaymentTimingRow {
  customerName: string;
  invoicesConsidered: number;
  avgDaysToFirstPayment: number;
  medianDaysToFirstPayment: number;
  worstDaysToFirstPayment: number;
  bestDaysToFirstPayment: number;
}

export interface FirstPaymentTimingRollup {
  customersConsidered: number;
  invoicesConsidered: number;
  blendedAvgDaysToFirstPayment: number;
  /** Customers averaging >45 days to first payment — slow movers. */
  slowMoverCount: number;
}

export interface FirstPaymentTimingInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  /** Default case-insensitive merge of customer name variants. */
  caseInsensitive?: boolean;
}

export function buildCustomerFirstPaymentTiming(
  inputs: FirstPaymentTimingInputs,
): {
  rollup: FirstPaymentTimingRollup;
  rows: FirstPaymentTimingRow[];
} {
  const caseInsensitive = inputs.caseInsensitive !== false;

  // First-payment date per AR invoice id (smallest receivedOn
  // among AR payments matching).
  const firstByInvoice = new Map<string, string>();
  for (const p of inputs.arPayments) {
    const cur = firstByInvoice.get(p.arInvoiceId);
    if (!cur || p.receivedOn < cur) firstByInvoice.set(p.arInvoiceId, p.receivedOn);
  }

  type Bucket = {
    customerName: string;
    days: number[];
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    const sent = inv.sentAt ?? inv.invoiceDate;
    const sentDate = parseIsoDate(sent);
    if (!sentDate) continue;
    const firstPaid = firstByInvoice.get(inv.id);
    if (!firstPaid) continue;
    const paidDate = parseDate(firstPaid);
    if (!paidDate) continue;
    const days = Math.max(0, daysBetween(sentDate, paidDate));

    const key = caseInsensitive
      ? inv.customerName.trim().toLowerCase()
      : inv.customerName.trim();
    const b = buckets.get(key) ?? {
      customerName: inv.customerName.trim(),
      days: [],
    };
    b.days.push(days);
    buckets.set(key, b);
  }

  const rows: FirstPaymentTimingRow[] = [];
  let totalDays = 0;
  let totalInvoices = 0;
  let slowMovers = 0;

  for (const b of buckets.values()) {
    if (b.days.length === 0) continue;
    const sorted = [...b.days].sort((a, b) => a - b);
    const avg = b.days.reduce((acc, d) => acc + d, 0) / b.days.length;
    const median = computeMedian(sorted);
    rows.push({
      customerName: b.customerName,
      invoicesConsidered: b.days.length,
      avgDaysToFirstPayment: round1(avg),
      medianDaysToFirstPayment: round1(median),
      worstDaysToFirstPayment: sorted[sorted.length - 1]!,
      bestDaysToFirstPayment: sorted[0]!,
    });
    totalDays += b.days.reduce((acc, d) => acc + d, 0);
    totalInvoices += b.days.length;
    if (avg > 45) slowMovers += 1;
  }

  // Slowest first.
  rows.sort((a, b) => b.avgDaysToFirstPayment - a.avgDaysToFirstPayment);

  return {
    rollup: {
      customersConsidered: rows.length,
      invoicesConsidered: totalInvoices,
      blendedAvgDaysToFirstPayment:
        totalInvoices === 0 ? 0 : round1(totalDays / totalInvoices),
      slowMoverCount: slowMovers,
    },
    rows,
  };
}

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIsoDate(s: string): Date | null {
  return parseDate(s.slice(0, 10));
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
