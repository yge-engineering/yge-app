// Per-customer lifetime view.
//
// Plain English: for each canonical customer, total billings + paid +
// outstanding across the AR history, distinct jobs touched, first /
// last invoice date, lifetime span in days.
//
// Different from customer-revenue-trend (monthly trend),
// customer-concentration (share of total), customer-open-ar
// (current balance only). This is the all-time per-customer
// aggregate view.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface CustomerLifetimeRow {
  customerName: string;
  invoiceCount: number;
  totalBilledCents: number;
  totalPaidCents: number;
  outstandingCents: number;
  distinctJobs: number;
  firstInvoiceDate: string | null;
  lastInvoiceDate: string | null;
  lifetimeSpanDays: number;
}

export interface CustomerLifetimeRollup {
  customersConsidered: number;
  totalBilledCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
}

export interface CustomerLifetimeInputs {
  arInvoices: ArInvoice[];
}

export function buildCustomerLifetime(inputs: CustomerLifetimeInputs): {
  rollup: CustomerLifetimeRollup;
  rows: CustomerLifetimeRow[];
} {
  type Acc = {
    display: string;
    invoiceCount: number;
    billed: number;
    paid: number;
    jobs: Set<string>;
    firstDate: string;
    lastDate: string;
  };
  const accs = new Map<string, Acc>();

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT') continue;
    const date = inv.createdAt.slice(0, 10);
    if (date.length < 10) continue;
    let total = 0;
    for (const li of inv.lineItems) total += li.lineTotalCents;
    const key = canonicalize(inv.customerName);
    const acc = accs.get(key) ?? {
      display: inv.customerName,
      invoiceCount: 0,
      billed: 0,
      paid: 0,
      jobs: new Set<string>(),
      firstDate: '',
      lastDate: '',
    };
    acc.invoiceCount += 1;
    acc.billed += total;
    acc.paid += inv.paidCents;
    acc.jobs.add(inv.jobId);
    if (acc.firstDate === '' || date < acc.firstDate) acc.firstDate = date;
    if (date > acc.lastDate) acc.lastDate = date;
    accs.set(key, acc);
  }

  let totalBilled = 0;
  let totalPaid = 0;

  const rows: CustomerLifetimeRow[] = [];
  for (const acc of accs.values()) {
    const span = acc.firstDate && acc.lastDate
      ? daysBetween(acc.firstDate, acc.lastDate)
      : 0;
    rows.push({
      customerName: acc.display,
      invoiceCount: acc.invoiceCount,
      totalBilledCents: acc.billed,
      totalPaidCents: acc.paid,
      outstandingCents: acc.billed - acc.paid,
      distinctJobs: acc.jobs.size,
      firstInvoiceDate: acc.firstDate || null,
      lastInvoiceDate: acc.lastDate || null,
      lifetimeSpanDays: span,
    });
    totalBilled += acc.billed;
    totalPaid += acc.paid;
  }

  rows.sort((a, b) => b.totalBilledCents - a.totalBilledCents);

  return {
    rollup: {
      customersConsidered: rows.length,
      totalBilledCents: totalBilled,
      totalPaidCents: totalPaid,
      totalOutstandingCents: totalBilled - totalPaid,
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
