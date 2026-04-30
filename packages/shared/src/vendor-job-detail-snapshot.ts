// Vendor-anchored per-job detail snapshot.
//
// Plain English: for one vendor (matched via canonicalized
// name), as-of today, return one row per job with that
// vendor's AP-billed cents + expense-receipt cents + total.
// Sorted descending by total spend.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

export interface VendorJobDetailRow {
  jobId: string;
  apBilledCents: number;
  expenseReceiptCents: number;
  totalSpendCents: number;
}

export interface VendorJobDetailSnapshotResult {
  asOf: string;
  vendorName: string;
  rows: VendorJobDetailRow[];
}

export interface VendorJobDetailSnapshotInputs {
  vendorName: string;
  apInvoices: ApInvoice[];
  expenses: Expense[];
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

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildVendorJobDetailSnapshot(
  inputs: VendorJobDetailSnapshotInputs,
): VendorJobDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = normVendor(inputs.vendorName);

  const byJob = new Map<string, { ap: number; exp: number }>();

  for (const inv of inputs.apInvoices) {
    if (normVendor(inv.vendorName) !== target) continue;
    if (inv.invoiceDate > asOf) continue;
    if (!inv.jobId) continue;
    const cur = byJob.get(inv.jobId) ?? { ap: 0, exp: 0 };
    cur.ap += inv.totalCents ?? 0;
    byJob.set(inv.jobId, cur);
  }
  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    if (e.receiptDate > asOf) continue;
    if (!e.jobId) continue;
    const cur = byJob.get(e.jobId) ?? { ap: 0, exp: 0 };
    cur.exp += e.amountCents;
    byJob.set(e.jobId, cur);
  }

  const rows: VendorJobDetailRow[] = [...byJob.entries()]
    .map(([jobId, v]) => ({
      jobId,
      apBilledCents: v.ap,
      expenseReceiptCents: v.exp,
      totalSpendCents: v.ap + v.exp,
    }))
    .sort((a, b) => b.totalSpendCents - a.totalSpendCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    vendorName: inputs.vendorName,
    rows,
  };
}
