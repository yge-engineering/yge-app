// Portfolio AP snapshot (point-in-time).
//
// Plain English: as-of date, sum every AP invoice's billed,
// paid (non-voided), open; bucket open by age; count distinct
// vendors + jobs. Drives the right-now AP overview.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

export interface PortfolioApSnapshotResult {
  asOf: string;
  totalCents: number;
  paidCents: number;
  openCents: number;
  invoiceCount: number;
  openInvoiceCount: number;
  currentCents: number;
  days1to30Cents: number;
  days31to60Cents: number;
  days61to90Cents: number;
  days90PlusCents: number;
  distinctVendors: number;
  distinctJobs: number;
}

export interface PortfolioApSnapshotInputs {
  apInvoices: ApInvoice[];
  apPayments: ApPayment[];
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

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPortfolioApSnapshot(
  inputs: PortfolioApSnapshotInputs,
): PortfolioApSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  let totalCents = 0;
  let paidCents = 0;
  let invoiceCount = 0;
  let openInvoiceCount = 0;
  let currentCents = 0;
  let d1to30 = 0;
  let d31to60 = 0;
  let d61to90 = 0;
  let d90Plus = 0;
  const vendors = new Set<string>();
  const jobs = new Set<string>();

  function paidByInvoiceBeforeDate(invoiceId: string): number {
    let total = 0;
    for (const p of inputs.apPayments) {
      if (p.voided) continue;
      if (p.apInvoiceId !== invoiceId) continue;
      if (p.paidOn > asOf) continue;
      total += p.amountCents;
    }
    return total;
  }

  for (const inv of inputs.apInvoices) {
    if (inv.invoiceDate > asOf) continue;
    invoiceCount += 1;
    totalCents += inv.totalCents ?? 0;
    vendors.add(normVendor(inv.vendorName));
    if (inv.jobId) jobs.add(inv.jobId);

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
    invoiceCount,
    openInvoiceCount,
    currentCents,
    days1to30Cents: d1to30,
    days31to60Cents: d31to60,
    days61to90Cents: d61to90,
    days90PlusCents: d90Plus,
    distinctVendors: vendors.size,
    distinctJobs: jobs.size,
  };
}
