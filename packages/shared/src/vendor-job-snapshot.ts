// Vendor-anchored job snapshot.
//
// Plain English: for one vendor (matched via canonicalized
// name), as-of today, count distinct jobs they've billed
// against (AP) or been expensed at (employee receipts).
// Surface per-rail and combined job count + spend.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

export interface VendorJobSnapshotResult {
  asOf: string;
  vendorName: string;
  distinctJobs: number;
  apJobCount: number;
  expenseJobCount: number;
  apBilledCents: number;
  expenseReceiptCents: number;
  totalSpendCents: number;
}

export interface VendorJobSnapshotInputs {
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

export function buildVendorJobSnapshot(
  inputs: VendorJobSnapshotInputs,
): VendorJobSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = normVendor(inputs.vendorName);

  const apJobs = new Set<string>();
  const expenseJobs = new Set<string>();
  let apBilledCents = 0;
  let expenseReceiptCents = 0;

  for (const inv of inputs.apInvoices) {
    if (normVendor(inv.vendorName) !== target) continue;
    if (inv.invoiceDate > asOf) continue;
    if (inv.jobId) apJobs.add(inv.jobId);
    apBilledCents += inv.totalCents ?? 0;
  }
  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    if (e.receiptDate > asOf) continue;
    if (e.jobId) expenseJobs.add(e.jobId);
    expenseReceiptCents += e.amountCents;
  }

  const allJobs = new Set<string>([...apJobs, ...expenseJobs]);

  return {
    asOf,
    vendorName: inputs.vendorName,
    distinctJobs: allJobs.size,
    apJobCount: apJobs.size,
    expenseJobCount: expenseJobs.size,
    apBilledCents,
    expenseReceiptCents,
    totalSpendCents: apBilledCents + expenseReceiptCents,
  };
}
