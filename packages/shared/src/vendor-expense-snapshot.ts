// Vendor-anchored expense snapshot.
//
// Plain English: for one vendor (matched via canonicalized
// expense.vendor), as-of today, count expense receipts at this
// vendor, sum cents, category mix, distinct employees + jobs,
// last receipt date.
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

export interface VendorExpenseSnapshotResult {
  asOf: string;
  vendorName: string;
  totalReceipts: number;
  totalCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  distinctEmployees: number;
  distinctJobs: number;
  lastReceiptDate: string | null;
}

export interface VendorExpenseSnapshotInputs {
  vendorName: string;
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

export function buildVendorExpenseSnapshot(
  inputs: VendorExpenseSnapshotInputs,
): VendorExpenseSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = normVendor(inputs.vendorName);

  const byCategory = new Map<ExpenseCategory, number>();
  const employees = new Set<string>();
  const jobs = new Set<string>();
  let totalReceipts = 0;
  let totalCents = 0;
  let lastReceiptDate: string | null = null;

  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    if (e.receiptDate > asOf) continue;
    totalReceipts += 1;
    totalCents += e.amountCents;
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    employees.add(e.employeeId);
    if (e.jobId) jobs.add(e.jobId);
    if (lastReceiptDate == null || e.receiptDate > lastReceiptDate) lastReceiptDate = e.receiptDate;
  }

  const out: Partial<Record<ExpenseCategory, number>> = {};
  for (const [k, v] of byCategory) out[k] = v;

  return {
    asOf,
    vendorName: inputs.vendorName,
    totalReceipts,
    totalCents,
    byCategory: out,
    distinctEmployees: employees.size,
    distinctJobs: jobs.size,
    lastReceiptDate,
  };
}
