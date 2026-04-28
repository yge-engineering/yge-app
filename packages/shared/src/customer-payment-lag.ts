// Per-customer AR payment lag distribution.
//
// Plain English: for each customer (canonicalized name), pair every
// AR invoice we sent with the first AR payment that landed on it,
// and surface the distribution of "days from sent → first cash":
//   - median days
//   - 25th percentile (the quick-pay tail)
//   - 75th percentile (the slow-pay tail)
//   - 90th percentile (the worst-cases tail)
//   - max
//
// Different from:
//   - customer-first-payment-timing (single window, single number)
//   - customer-payment-velocity (early/on-time/late buckets)
//   - customer-dso (DSO-style outstanding)
//
// This is the distribution view — useful when one customer's median
// is fine but a 90th-percentile outlier signals a single late
// payment risk.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface CustomerPaymentLagRow {
  customerName: string;
  invoicesPaired: number;
  invoicesUnpaid: number;
  medianDays: number | null;
  p25Days: number | null;
  p75Days: number | null;
  p90Days: number | null;
  maxDays: number | null;
}

export interface CustomerPaymentLagRollup {
  customersConsidered: number;
  totalInvoicesPaired: number;
  totalInvoicesUnpaid: number;
  /** Blended median across all paired samples in the window. */
  blendedMedianDays: number | null;
}

export interface CustomerPaymentLagInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  /** Optional inclusive yyyy-mm-dd window applied to invoice
   *  createdAt date prefix. */
  fromDate?: string;
  toDate?: string;
}

export function buildCustomerPaymentLag(
  inputs: CustomerPaymentLagInputs,
): {
  rollup: CustomerPaymentLagRollup;
  rows: CustomerPaymentLagRow[];
} {
  // Map arInvoiceId → first paid date.
  const firstPaymentByInvoice = new Map<string, string>();
  for (const p of inputs.arPayments) {
    const cur = firstPaymentByInvoice.get(p.arInvoiceId);
    if (!cur || p.receivedOn < cur) {
      firstPaymentByInvoice.set(p.arInvoiceId, p.receivedOn);
    }
  }

  // Bucket invoices by canonical customer name.
  const buckets = new Map<string, ArInvoice[]>();
  const displayNames = new Map<string, string>();
  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT') continue;
    const sentDate = inv.createdAt.slice(0, 10);
    if (sentDate.length < 10) continue;
    if (inputs.fromDate && sentDate < inputs.fromDate) continue;
    if (inputs.toDate && sentDate > inputs.toDate) continue;
    const key = canonicalize(inv.customerName);
    const list = buckets.get(key) ?? [];
    list.push(inv);
    buckets.set(key, list);
    if (!displayNames.has(key)) displayNames.set(key, inv.customerName);
  }

  const rows: CustomerPaymentLagRow[] = [];
  let totalPaired = 0;
  let totalUnpaid = 0;
  const allDays: number[] = [];

  for (const [key, invs] of buckets.entries()) {
    const days: number[] = [];
    let unpaid = 0;
    for (const inv of invs) {
      const sent = inv.createdAt.slice(0, 10);
      const firstPaid = firstPaymentByInvoice.get(inv.id);
      if (!firstPaid) {
        unpaid += 1;
        continue;
      }
      const d = daysBetween(sent, firstPaid);
      if (d >= 0) {
        days.push(d);
        allDays.push(d);
      }
    }
    days.sort((a, b) => a - b);
    rows.push({
      customerName: displayNames.get(key) ?? key,
      invoicesPaired: days.length,
      invoicesUnpaid: unpaid,
      medianDays: percentile(days, 0.5),
      p25Days: percentile(days, 0.25),
      p75Days: percentile(days, 0.75),
      p90Days: percentile(days, 0.9),
      maxDays: days.length === 0 ? null : (days[days.length - 1] ?? null),
    });
    totalPaired += days.length;
    totalUnpaid += unpaid;
  }

  // Sort: highest median (slowest payers) first; null medians sort to the bottom.
  rows.sort((a, b) => {
    const am = a.medianDays;
    const bm = b.medianDays;
    if (am === null && bm === null) return a.customerName.localeCompare(b.customerName);
    if (am === null) return 1;
    if (bm === null) return -1;
    return bm - am;
  });

  allDays.sort((a, b) => a - b);

  return {
    rollup: {
      customersConsidered: rows.length,
      totalInvoicesPaired: totalPaired,
      totalInvoicesUnpaid: totalUnpaid,
      blendedMedianDays: percentile(allDays, 0.5),
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0] ?? null;
  // Linear-interpolation method (Type 7, the R / Excel default).
  const rank = p * (sortedAsc.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedAsc[lower] ?? null;
  const frac = rank - lower;
  const lo = sortedAsc[lower] ?? 0;
  const hi = sortedAsc[upper] ?? 0;
  return Math.round((lo + (hi - lo) * frac) * 10) / 10;
}
