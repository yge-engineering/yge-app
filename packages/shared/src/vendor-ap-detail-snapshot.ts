// Vendor-anchored per-job AP invoice detail snapshot.
//
// Plain English: for one vendor (matched by canonicalized
// vendorName), return one row per job they billed against:
// invoice count, billed cents, paid cents, outstanding cents,
// oldest unpaid invoice date, last invoice date. Sorted by
// outstanding desc.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface VendorApDetailRow {
  jobId: string;
  invoiceCount: number;
  billedCents: number;
  paidCents: number;
  outstandingCents: number;
  oldestUnpaidDate: string | null;
  lastInvoiceDate: string | null;
}

export interface VendorApDetailSnapshotResult {
  asOf: string;
  vendorName: string;
  rows: VendorApDetailRow[];
}

export interface VendorApDetailSnapshotInputs {
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

export function buildVendorApDetailSnapshot(
  inputs: VendorApDetailSnapshotInputs,
): VendorApDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = canonVendor(inputs.vendorName);

  type Acc = {
    count: number;
    billed: number;
    paid: number;
    oldestUnpaid: string | null;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { count: 0, billed: 0, paid: 0, oldestUnpaid: null, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const inv of inputs.apInvoices) {
    if (canonVendor(inv.vendorName) !== target) continue;
    if (!inv.jobId) continue;
    if (inv.invoiceDate > asOf) continue;
    if (inv.status === 'REJECTED') continue;
    const a = getAcc(inv.jobId);
    a.count += 1;
    a.billed += inv.totalCents;
    a.paid += inv.paidCents;
    if (inv.totalCents > inv.paidCents) {
      if (a.oldestUnpaid == null || inv.invoiceDate < a.oldestUnpaid) {
        a.oldestUnpaid = inv.invoiceDate;
      }
    }
    if (a.lastDate == null || inv.invoiceDate > a.lastDate) a.lastDate = inv.invoiceDate;
  }

  const rows: VendorApDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      invoiceCount: a.count,
      billedCents: a.billed,
      paidCents: a.paid,
      outstandingCents: Math.max(0, a.billed - a.paid),
      oldestUnpaidDate: a.oldestUnpaid,
      lastInvoiceDate: a.lastDate,
    }))
    .sort((a, b) => b.outstandingCents - a.outstandingCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    vendorName: inputs.vendorName,
    rows,
  };
}
