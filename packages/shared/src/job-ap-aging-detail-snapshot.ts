// Job-anchored per-invoice AP aging detail snapshot.
//
// Plain English: for one job, return one row per unpaid AP
// invoice with its outstanding cents, age in days, vendor name
// (canonicalized for display), and aging bucket label. Rejected
// and paid invoices are excluded. Sorted by age descending.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export type Bucket = '0-30' | '31-60' | '61-90' | '91+';

export interface JobApAgingDetailRow {
  invoiceId: string;
  vendorName: string;
  invoiceDate: string;
  ageDays: number;
  bucket: Bucket;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
}

export interface JobApAgingDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobApAgingDetailRow[];
  totalOutstandingCents: number;
}

export interface JobApAgingDetailSnapshotInputs {
  jobId: string;
  apInvoices: ApInvoice[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function bucketFor(age: number): Bucket {
  if (age <= 30) return '0-30';
  if (age <= 60) return '31-60';
  if (age <= 90) return '61-90';
  return '91+';
}

export function buildJobApAgingDetailSnapshot(
  inputs: JobApAgingDetailSnapshotInputs,
): JobApAgingDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const rows: JobApAgingDetailRow[] = [];
  let totalOutstanding = 0;

  for (const inv of inputs.apInvoices) {
    if (inv.jobId !== inputs.jobId) continue;
    if (inv.invoiceDate > asOf) continue;
    if (inv.status === 'REJECTED' || inv.status === 'PAID') continue;
    const outstanding = Math.max(0, inv.totalCents - inv.paidCents);
    if (outstanding === 0) continue;
    const ageDays = daysBetween(inv.invoiceDate, asOf);
    rows.push({
      invoiceId: inv.id,
      vendorName: inv.vendorName,
      invoiceDate: inv.invoiceDate,
      ageDays,
      bucket: bucketFor(ageDays),
      totalCents: inv.totalCents,
      paidCents: inv.paidCents,
      outstandingCents: outstanding,
    });
    totalOutstanding += outstanding;
  }

  rows.sort((a, b) => b.ageDays - a.ageDays || a.invoiceId.localeCompare(b.invoiceId));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
    totalOutstandingCents: totalOutstanding,
  };
}
