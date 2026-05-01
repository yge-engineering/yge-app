// Job-anchored per-invoice AR aging detail snapshot.
//
// Plain English: for one job, return one row per unpaid AR
// invoice with its outstanding cents, age in days, and aging
// bucket label. Disputed and written-off are excluded. Sorted by
// age descending (oldest first).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

type Bucket = '0-30' | '31-60' | '61-90' | '91+';

export interface JobArAgingDetailRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  ageDays: number;
  bucket: Bucket;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
}

export interface JobArAgingDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobArAgingDetailRow[];
  totalOutstandingCents: number;
}

export interface JobArAgingDetailSnapshotInputs {
  jobId: string;
  arInvoices: ArInvoice[];
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

export function buildJobArAgingDetailSnapshot(
  inputs: JobArAgingDetailSnapshotInputs,
): JobArAgingDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const rows: JobArAgingDetailRow[] = [];
  let totalOutstanding = 0;

  for (const inv of inputs.arInvoices) {
    if (inv.jobId !== inputs.jobId) continue;
    if (inv.invoiceDate > asOf) continue;
    if (inv.status === 'WRITTEN_OFF' || inv.status === 'DISPUTED' || inv.status === 'PAID') continue;
    const outstanding = Math.max(0, inv.totalCents - inv.paidCents);
    if (outstanding === 0) continue;
    const ageDays = daysBetween(inv.invoiceDate, asOf);
    rows.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber ?? inv.id,
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
