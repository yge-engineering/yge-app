// Per-vendor lifetime AP aggregate.
//
// Plain English: for each canonical vendor, walks all AP invoices
// and surfaces total invoiced (sum of totalCents), total paid,
// outstanding, distinct jobs touched, first / last invoice date,
// lifetime span in days. Mirror of customer-lifetime on the AP
// side.
//
// Different from vendor-spend (window total),
// vendor-payment-velocity (timing buckets), vendor-1099 (year-end
// summary), and vendor-onhold-exposure (current open balances on
// hold). This is the all-time per-vendor aggregate.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface VendorLifetimeRow {
  vendorName: string;
  invoiceCount: number;
  totalInvoicedCents: number;
  totalPaidCents: number;
  outstandingCents: number;
  distinctJobs: number;
  firstInvoiceDate: string | null;
  lastInvoiceDate: string | null;
  lifetimeSpanDays: number;
}

export interface VendorLifetimeRollup {
  vendorsConsidered: number;
  totalInvoicedCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
}

export interface VendorLifetimeInputs {
  apInvoices: ApInvoice[];
}

export function buildVendorLifetime(inputs: VendorLifetimeInputs): {
  rollup: VendorLifetimeRollup;
  rows: VendorLifetimeRow[];
} {
  type Acc = {
    display: string;
    invoiceCount: number;
    invoiced: number;
    paid: number;
    jobs: Set<string>;
    firstDate: string;
    lastDate: string;
  };
  const accs = new Map<string, Acc>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    const key = canonicalize(inv.vendorName);
    const acc = accs.get(key) ?? {
      display: inv.vendorName,
      invoiceCount: 0,
      invoiced: 0,
      paid: 0,
      jobs: new Set<string>(),
      firstDate: '',
      lastDate: '',
    };
    acc.invoiceCount += 1;
    acc.invoiced += inv.totalCents;
    acc.paid += inv.paidCents;
    if (inv.jobId) acc.jobs.add(inv.jobId);
    if (acc.firstDate === '' || inv.invoiceDate < acc.firstDate) {
      acc.firstDate = inv.invoiceDate;
    }
    if (inv.invoiceDate > acc.lastDate) acc.lastDate = inv.invoiceDate;
    accs.set(key, acc);
  }

  let totalInvoiced = 0;
  let totalPaid = 0;

  const rows: VendorLifetimeRow[] = [];
  for (const acc of accs.values()) {
    const span = acc.firstDate && acc.lastDate
      ? daysBetween(acc.firstDate, acc.lastDate)
      : 0;
    rows.push({
      vendorName: acc.display,
      invoiceCount: acc.invoiceCount,
      totalInvoicedCents: acc.invoiced,
      totalPaidCents: acc.paid,
      outstandingCents: acc.invoiced - acc.paid,
      distinctJobs: acc.jobs.size,
      firstInvoiceDate: acc.firstDate || null,
      lastInvoiceDate: acc.lastDate || null,
      lifetimeSpanDays: span,
    });
    totalInvoiced += acc.invoiced;
    totalPaid += acc.paid;
  }

  rows.sort((a, b) => b.totalInvoicedCents - a.totalInvoicedCents);

  return {
    rollup: {
      vendorsConsidered: rows.length,
      totalInvoicedCents: totalInvoiced,
      totalPaidCents: totalPaid,
      totalOutstandingCents: totalInvoiced - totalPaid,
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
