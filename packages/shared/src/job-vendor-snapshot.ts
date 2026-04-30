// Job-anchored vendor snapshot.
//
// Plain English: for one job, as-of today, count distinct
// vendors who showed up either as an AP-invoice billing
// vendor or as an expense-receipt vendor on this job. Sum
// total AP cents + expense cents per rail and combined.
// Drives the right-now per-job vendor footprint overview.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

export interface JobVendorSnapshotResult {
  asOf: string;
  jobId: string;
  distinctVendors: number;
  apVendorCount: number;
  expenseVendorCount: number;
  apBilledCents: number;
  expenseReceiptCents: number;
  totalSpendCents: number;
}

export interface JobVendorSnapshotInputs {
  jobId: string;
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

export function buildJobVendorSnapshot(
  inputs: JobVendorSnapshotInputs,
): JobVendorSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const apVendors = new Set<string>();
  const expenseVendors = new Set<string>();
  let apBilledCents = 0;
  let expenseReceiptCents = 0;

  for (const inv of inputs.apInvoices) {
    if (inv.jobId !== inputs.jobId) continue;
    if (inv.invoiceDate > asOf) continue;
    apVendors.add(normVendor(inv.vendorName));
    apBilledCents += inv.totalCents ?? 0;
  }
  for (const e of inputs.expenses) {
    if (e.jobId !== inputs.jobId) continue;
    if (e.receiptDate > asOf) continue;
    expenseVendors.add(normVendor(e.vendor));
    expenseReceiptCents += e.amountCents;
  }

  const allVendors = new Set<string>([...apVendors, ...expenseVendors]);

  return {
    asOf,
    jobId: inputs.jobId,
    distinctVendors: allVendors.size,
    apVendorCount: apVendors.size,
    expenseVendorCount: expenseVendors.size,
    apBilledCents,
    expenseReceiptCents,
    totalSpendCents: apBilledCents + expenseReceiptCents,
  };
}
