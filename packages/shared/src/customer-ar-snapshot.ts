// Customer-anchored AR snapshot.
//
// Plain English: for one customer, as-of today, sum every AR
// invoice issued to them: billed/paid/open/retention, age
// buckets, distinct jobs. Drives the right-now per-customer
// receivables overview on the customer-detail page.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface CustomerArSnapshotResult {
  asOf: string;
  customerName: string;
  totalCents: number;
  paidCents: number;
  openCents: number;
  retentionCents: number;
  invoiceCount: number;
  openInvoiceCount: number;
  currentCents: number;
  days1to30Cents: number;
  days31to60Cents: number;
  days61to90Cents: number;
  days90PlusCents: number;
  distinctJobs: number;
}

export interface CustomerArSnapshotInputs {
  customerName: string;
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

const MS_PER_DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / MS_PER_DAY,
  );
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function buildCustomerArSnapshot(
  inputs: CustomerArSnapshotInputs,
): CustomerArSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  let totalCents = 0;
  let paidCents = 0;
  let retentionCents = 0;
  let invoiceCount = 0;
  let openInvoiceCount = 0;
  let currentCents = 0;
  let d1to30 = 0;
  let d31to60 = 0;
  let d61to90 = 0;
  let d90Plus = 0;
  const jobs = new Set<string>();

  function paidByInvoiceBeforeDate(invoiceId: string): number {
    let total = 0;
    for (const p of inputs.arPayments) {
      if (p.arInvoiceId !== invoiceId) continue;
      if (p.receivedOn > asOf) continue;
      total += p.amountCents;
    }
    return total;
  }

  for (const inv of inputs.arInvoices) {
    if (norm(inv.customerName) !== target) continue;
    if (inv.invoiceDate > asOf) continue;
    invoiceCount += 1;
    totalCents += inv.totalCents ?? 0;
    retentionCents += inv.retentionCents ?? 0;
    jobs.add(inv.jobId);

    const paidAsOf = paidByInvoiceBeforeDate(inv.id);
    paidCents += paidAsOf;
    const open = (inv.totalCents ?? 0) - paidAsOf;
    if (open <= 0) continue;
    openInvoiceCount += 1;
    const age = daysBetween(inv.invoiceDate, asOf);
    if (age <= 0) currentCents += open;
    else if (age <= 30) d1to30 += open;
    else if (age <= 60) d31to60 += open;
    else if (age <= 90) d61to90 += open;
    else d90Plus += open;
  }

  return {
    asOf,
    customerName: inputs.customerName,
    totalCents,
    paidCents,
    openCents: Math.max(0, totalCents - paidCents),
    retentionCents,
    invoiceCount,
    openInvoiceCount,
    currentCents,
    days1to30Cents: d1to30,
    days31to60Cents: d31to60,
    days61to90Cents: d61to90,
    days90PlusCents: d90Plus,
    distinctJobs: jobs.size,
  };
}
