// Vendor-anchored total spend snapshot.
//
// Plain English: for one vendor (matched via canonicalized
// name), as-of today, total spend = AP-billed cents + expense-
// receipt cents. Surfaces both rails individually so it's easy
// to see "we owe Granite $250K and we expensed $5K at the gas
// station receipts under their name." Useful for vendor-detail
// pages.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

export interface VendorSpendSnapshotResult {
  asOf: string;
  vendorName: string;
  apBilledCents: number;
  expenseReceiptCents: number;
  totalSpendCents: number;
  apInvoiceCount: number;
  expenseReceiptCount: number;
  distinctJobs: number;
  lastActivityDate: string | null;
}

export interface VendorSpendSnapshotInputs {
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

export function buildVendorSpendSnapshot(
  inputs: VendorSpendSnapshotInputs,
): VendorSpendSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = normVendor(inputs.vendorName);

  let apBilledCents = 0;
  let expenseReceiptCents = 0;
  let apInvoiceCount = 0;
  let expenseReceiptCount = 0;
  const jobs = new Set<string>();
  let lastActivityDate: string | null = null;

  for (const inv of inputs.apInvoices) {
    if (normVendor(inv.vendorName) !== target) continue;
    if (inv.invoiceDate > asOf) continue;
    apInvoiceCount += 1;
    apBilledCents += inv.totalCents ?? 0;
    if (inv.jobId) jobs.add(inv.jobId);
    if (lastActivityDate == null || inv.invoiceDate > lastActivityDate) lastActivityDate = inv.invoiceDate;
  }
  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    if (e.receiptDate > asOf) continue;
    expenseReceiptCount += 1;
    expenseReceiptCents += e.amountCents;
    if (e.jobId) jobs.add(e.jobId);
    if (lastActivityDate == null || e.receiptDate > lastActivityDate) lastActivityDate = e.receiptDate;
  }

  return {
    asOf,
    vendorName: inputs.vendorName,
    apBilledCents,
    expenseReceiptCents,
    totalSpendCents: apBilledCents + expenseReceiptCents,
    apInvoiceCount,
    expenseReceiptCount,
    distinctJobs: jobs.size,
    lastActivityDate,
  };
}
