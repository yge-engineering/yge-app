// Vendor-anchored per-job employee-expense detail snapshot.
//
// Plain English: for one vendor (matched by canonicalized
// expense.vendor), return one row per job they show up on:
// receipt count, total cents, distinct employees, last receipt
// date. Sorted by total cents desc.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';

export interface VendorExpenseDetailRow {
  jobId: string;
  receiptCount: number;
  totalCents: number;
  distinctEmployees: number;
  lastReceiptDate: string | null;
}

export interface VendorExpenseDetailSnapshotResult {
  asOf: string;
  vendorName: string;
  rows: VendorExpenseDetailRow[];
}

export interface VendorExpenseDetailSnapshotInputs {
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

function canonVendor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,&'()]/g, ' ')
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildVendorExpenseDetailSnapshot(
  inputs: VendorExpenseDetailSnapshotInputs,
): VendorExpenseDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = canonVendor(inputs.vendorName);

  type Acc = {
    count: number;
    cents: number;
    employees: Set<string>;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { count: 0, cents: 0, employees: new Set(), lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const ex of inputs.expenses) {
    if (canonVendor(ex.vendor) !== target) continue;
    if (!ex.jobId) continue;
    if (ex.receiptDate > asOf) continue;
    const a = getAcc(ex.jobId);
    a.count += 1;
    a.cents += ex.amountCents;
    a.employees.add(ex.employeeId);
    if (a.lastDate == null || ex.receiptDate > a.lastDate) a.lastDate = ex.receiptDate;
  }

  const rows: VendorExpenseDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      receiptCount: a.count,
      totalCents: a.cents,
      distinctEmployees: a.employees.size,
      lastReceiptDate: a.lastDate,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    vendorName: inputs.vendorName,
    rows,
  };
}
