// Per-customer outstanding AR snapshot.
//
// Plain English: aging.ts gives the per-invoice and per-party
// aging report. This module is the morning-glance answer to
// "who do I call today?" One row per customer with open AR,
// sorted by oldest-debt-first so the most-overdue customers
// surface at the top.
//
// Per row:
//   - count of open invoices
//   - total outstanding $
//   - oldest open invoice date + days since
//   - bucketed counts (0-30 / 31-60 / 61-90 / 90+ days)
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export type OpenArBucket = '0-30' | '31-60' | '61-90' | '90+';

export interface CustomerOpenArRow {
  customerName: string;
  openInvoiceCount: number;
  totalOutstandingCents: number;
  oldestInvoiceDate: string;
  daysSinceOldest: number;
  bucket0to30Count: number;
  bucket31to60Count: number;
  bucket61to90Count: number;
  bucket90PlusCount: number;
  /** Customer-level "worst" bucket — drives the alert color. */
  worstBucket: OpenArBucket;
}

export interface CustomerOpenArRollup {
  customersConsidered: number;
  totalOpenInvoices: number;
  totalOutstandingCents: number;
  /** Customers with anything 90+ days. */
  customersWithDangerBucket: number;
}

export interface CustomerOpenArInputs {
  asOf?: string;
  arInvoices: ArInvoice[];
  /** When true (default), case-insensitively merge customer
   *  name variants. */
  caseInsensitive?: boolean;
}

export function buildCustomerOpenAr(inputs: CustomerOpenArInputs): {
  rollup: CustomerOpenArRollup;
  rows: CustomerOpenArRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const caseInsensitive = inputs.caseInsensitive !== false;

  type Bucket = {
    customerName: string;
    openInvoiceCount: number;
    totalOpen: number;
    oldestDate: string;
    b0to30: number;
    b31to60: number;
    b61to90: number;
    b90Plus: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (
      inv.status === 'DRAFT' ||
      inv.status === 'PAID' ||
      inv.status === 'WRITTEN_OFF'
    ) continue;
    const open = Math.max(0, inv.totalCents - inv.paidCents);
    if (open <= 0) continue;

    const sentParsed = parseDate(inv.invoiceDate);
    if (!sentParsed) continue;
    // Effective due = dueDate if set, else invoiceDate + 30
    const effectiveDue = inv.dueDate
      ? parseDate(inv.dueDate) ?? new Date(sentParsed.getTime() + 30 * 24 * 60 * 60 * 1000)
      : new Date(sentParsed.getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysOverdue = Math.max(0, daysBetween(effectiveDue, refNow));

    const key = caseInsensitive
      ? inv.customerName.trim().toLowerCase()
      : inv.customerName.trim();
    const b = buckets.get(key) ?? {
      customerName: inv.customerName.trim(),
      openInvoiceCount: 0,
      totalOpen: 0,
      oldestDate: inv.invoiceDate,
      b0to30: 0,
      b31to60: 0,
      b61to90: 0,
      b90Plus: 0,
    };
    b.openInvoiceCount += 1;
    b.totalOpen += open;
    if (inv.invoiceDate < b.oldestDate) b.oldestDate = inv.invoiceDate;
    if (daysOverdue <= 30) b.b0to30 += 1;
    else if (daysOverdue <= 60) b.b31to60 += 1;
    else if (daysOverdue <= 90) b.b61to90 += 1;
    else b.b90Plus += 1;
    buckets.set(key, b);
  }

  const rows: CustomerOpenArRow[] = [];
  let totalOpenInvoices = 0;
  let totalOutstanding = 0;
  let dangerCustomers = 0;

  for (const b of buckets.values()) {
    const oldestParsed = parseDate(b.oldestDate);
    const daysSinceOldest = oldestParsed
      ? Math.max(0, daysBetween(oldestParsed, refNow))
      : 0;

    let worst: OpenArBucket = '0-30';
    if (b.b90Plus > 0) worst = '90+';
    else if (b.b61to90 > 0) worst = '61-90';
    else if (b.b31to60 > 0) worst = '31-60';

    rows.push({
      customerName: b.customerName,
      openInvoiceCount: b.openInvoiceCount,
      totalOutstandingCents: b.totalOpen,
      oldestInvoiceDate: b.oldestDate,
      daysSinceOldest,
      bucket0to30Count: b.b0to30,
      bucket31to60Count: b.b31to60,
      bucket61to90Count: b.b61to90,
      bucket90PlusCount: b.b90Plus,
      worstBucket: worst,
    });
    totalOpenInvoices += b.openInvoiceCount;
    totalOutstanding += b.totalOpen;
    if (b.b90Plus > 0) dangerCustomers += 1;
  }

  // Worst bucket first, then daysSinceOldest desc.
  const tierRank: Record<OpenArBucket, number> = {
    '90+': 0,
    '61-90': 1,
    '31-60': 2,
    '0-30': 3,
  };
  rows.sort((a, b) => {
    if (a.worstBucket !== b.worstBucket) {
      return tierRank[a.worstBucket] - tierRank[b.worstBucket];
    }
    return b.daysSinceOldest - a.daysSinceOldest;
  });

  return {
    rollup: {
      customersConsidered: rows.length,
      totalOpenInvoices,
      totalOutstandingCents: totalOutstanding,
      customersWithDangerBucket: dangerCustomers,
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
