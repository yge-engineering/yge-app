// Per-customer AR aging snapshot.
//
// Plain English: as of asOf, for each customer, sum up the
// outstanding balance on their open invoices and bucket by age
// past invoice date:
//   0-30, 31-60, 61-90, 90+
//
// Per row: outstandingCents in each bucket, total outstanding,
// open invoice count, oldest open invoice age. Sort puts the
// most past-90 dollars at the top.
//
// Different from:
//   - aging (portfolio AR + AP combined)
//   - job-ar-aging (per-job)
//   - customer-open-ar (per-customer total without aging)
//
// This is the per-customer aging matrix the bookkeeper hands
// to Brook on Friday.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface CustomerArAgingRow {
  customerName: string;
  bucket0to30Cents: number;
  bucket31to60Cents: number;
  bucket61to90Cents: number;
  bucket90PlusCents: number;
  totalOutstandingCents: number;
  openInvoiceCount: number;
  oldestOpenAgeDays: number | null;
}

export interface CustomerArAgingRollup {
  customersConsidered: number;
  total0to30: number;
  total31to60: number;
  total61to90: number;
  total90Plus: number;
  totalOutstanding: number;
}

export interface CustomerArAgingInputs {
  arInvoices: ArInvoice[];
  /** As-of yyyy-mm-dd. Defaults to today's date derived from the
   *  latest invoice createdAt observed. */
  asOf?: string;
}

export function buildCustomerArAging(inputs: CustomerArAgingInputs): {
  rollup: CustomerArAgingRollup;
  rows: CustomerArAgingRow[];
} {
  let asOf = inputs.asOf;
  if (!asOf) {
    let latest = '';
    for (const inv of inputs.arInvoices) {
      const d = inv.createdAt.slice(0, 10);
      if (d > latest) latest = d;
    }
    asOf = latest || '1970-01-01';
  }

  // Bucket invoices by canonical customer name. Only invoices
  // with a positive outstanding balance count.
  type Acc = {
    display: string;
    b0_30: number;
    b31_60: number;
    b61_90: number;
    b90: number;
    open: number;
    oldestAge: number | null;
  };
  const accs = new Map<string, Acc>();

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    let total = 0;
    for (const li of inv.lineItems) total += li.lineTotalCents;
    const outstanding = total - inv.paidCents;
    if (outstanding <= 0) continue;
    const sentDate = inv.createdAt.slice(0, 10);
    const age = daysBetween(sentDate, asOf);
    if (age < 0) continue;

    const key = canonicalize(inv.customerName);
    const acc = accs.get(key) ?? {
      display: inv.customerName,
      b0_30: 0,
      b31_60: 0,
      b61_90: 0,
      b90: 0,
      open: 0,
      oldestAge: null,
    };
    if (age <= 30) acc.b0_30 += outstanding;
    else if (age <= 60) acc.b31_60 += outstanding;
    else if (age <= 90) acc.b61_90 += outstanding;
    else acc.b90 += outstanding;
    acc.open += 1;
    if (acc.oldestAge === null || age > acc.oldestAge) acc.oldestAge = age;
    accs.set(key, acc);
  }

  let total0_30 = 0;
  let total31_60 = 0;
  let total61_90 = 0;
  let total90 = 0;

  const rows: CustomerArAgingRow[] = [];
  for (const acc of accs.values()) {
    const total = acc.b0_30 + acc.b31_60 + acc.b61_90 + acc.b90;
    rows.push({
      customerName: acc.display,
      bucket0to30Cents: acc.b0_30,
      bucket31to60Cents: acc.b31_60,
      bucket61to90Cents: acc.b61_90,
      bucket90PlusCents: acc.b90,
      totalOutstandingCents: total,
      openInvoiceCount: acc.open,
      oldestOpenAgeDays: acc.oldestAge,
    });
    total0_30 += acc.b0_30;
    total31_60 += acc.b31_60;
    total61_90 += acc.b61_90;
    total90 += acc.b90;
  }

  // Sort: most 90+ dollars first; ties broken by total outstanding desc.
  rows.sort((a, b) => {
    if (a.bucket90PlusCents !== b.bucket90PlusCents) {
      return b.bucket90PlusCents - a.bucket90PlusCents;
    }
    return b.totalOutstandingCents - a.totalOutstandingCents;
  });

  return {
    rollup: {
      customersConsidered: rows.length,
      total0to30: total0_30,
      total31to60: total31_60,
      total61to90: total61_90,
      total90Plus: total90,
      totalOutstanding: total0_30 + total31_60 + total61_90 + total90,
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
