// Vendor-anchored per-job AP aging detail snapshot.
//
// Plain English: for one vendor (matched by canonicalized
// vendorName), return one row per job with their unpaid AP rolled
// into 0-30, 31-60, 61-90, 91+ day buckets based on invoiceDate
// vs asOf. Rejected and paid invoices are excluded. Sorted by
// total outstanding desc.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface VendorApAgingDetailRow {
  jobId: string;
  bucket0to30Cents: number;
  bucket31to60Cents: number;
  bucket61to90Cents: number;
  bucket91plusCents: number;
  totalOutstandingCents: number;
  invoiceCount: number;
}

export interface VendorApAgingDetailSnapshotResult {
  asOf: string;
  vendorName: string;
  rows: VendorApAgingDetailRow[];
}

export interface VendorApAgingDetailSnapshotInputs {
  vendorName: string;
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

function canonVendor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,&'()]/g, ' ')
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function buildVendorApAgingDetailSnapshot(
  inputs: VendorApAgingDetailSnapshotInputs,
): VendorApAgingDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = canonVendor(inputs.vendorName);

  type Acc = {
    b0to30: number;
    b31to60: number;
    b61to90: number;
    b91plus: number;
    total: number;
    count: number;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { b0to30: 0, b31to60: 0, b61to90: 0, b91plus: 0, total: 0, count: 0 };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const inv of inputs.apInvoices) {
    if (canonVendor(inv.vendorName) !== target) continue;
    if (!inv.jobId) continue;
    if (inv.invoiceDate > asOf) continue;
    if (inv.status === 'REJECTED' || inv.status === 'PAID') continue;
    const outstanding = Math.max(0, inv.totalCents - inv.paidCents);
    if (outstanding === 0) continue;
    const a = getAcc(inv.jobId);
    a.count += 1;
    a.total += outstanding;
    const age = daysBetween(inv.invoiceDate, asOf);
    if (age <= 30) a.b0to30 += outstanding;
    else if (age <= 60) a.b31to60 += outstanding;
    else if (age <= 90) a.b61to90 += outstanding;
    else a.b91plus += outstanding;
  }

  const rows: VendorApAgingDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      bucket0to30Cents: a.b0to30,
      bucket31to60Cents: a.b31to60,
      bucket61to90Cents: a.b61to90,
      bucket91plusCents: a.b91plus,
      totalOutstandingCents: a.total,
      invoiceCount: a.count,
    }))
    .sort((a, b) => b.totalOutstandingCents - a.totalOutstandingCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    vendorName: inputs.vendorName,
    rows,
  };
}
