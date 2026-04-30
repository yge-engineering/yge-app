// Portfolio AR snapshot (point-in-time).
//
// Plain English: as-of date, sum every AR invoice's billed,
// paid, open, retention; bucket open by age; count distinct
// customers + jobs. Drives the right-now AR overview on the
// owner dashboard.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface PortfolioArSnapshotResult {
  asOf: string;
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
  distinctCustomers: number;
  distinctJobs: number;
}

export interface PortfolioArSnapshotInputs {
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

export function buildPortfolioArSnapshot(
  inputs: PortfolioArSnapshotInputs,
): PortfolioArSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

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
  const customers = new Set<string>();
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
    if (inv.invoiceDate > asOf) continue;
    invoiceCount += 1;
    totalCents += inv.totalCents ?? 0;
    retentionCents += inv.retentionCents ?? 0;
    customers.add(inv.customerName.toLowerCase().trim());
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
    distinctCustomers: customers.size,
    distinctJobs: jobs.size,
  };
}
