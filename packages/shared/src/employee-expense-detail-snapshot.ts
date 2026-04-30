// Employee-anchored per-job expense detail snapshot.
//
// Plain English: for one employee, return one row per job they
// paid out-of-pocket on: receipt count, total cents, distinct
// vendors, company-card vs out-of-pocket breakouts, reimbursed
// count + cents, pending count + cents, last receipt date.
// Sorted by total cents desc.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';

export interface EmployeeExpenseDetailRow {
  jobId: string;
  receiptCount: number;
  totalCents: number;
  distinctVendors: number;
  oopReceipts: number;
  oopCents: number;
  reimbursedCents: number;
  pendingCents: number;
  lastReceiptDate: string | null;
}

export interface EmployeeExpenseDetailSnapshotResult {
  asOf: string;
  employeeId: string;
  rows: EmployeeExpenseDetailRow[];
}

export interface EmployeeExpenseDetailSnapshotInputs {
  employeeId: string;
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

export function buildEmployeeExpenseDetailSnapshot(
  inputs: EmployeeExpenseDetailSnapshotInputs,
): EmployeeExpenseDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    count: number;
    cents: number;
    vendors: Set<string>;
    oopReceipts: number;
    oopCents: number;
    reimbursedCents: number;
    pendingCents: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = {
        count: 0,
        cents: 0,
        vendors: new Set(),
        oopReceipts: 0,
        oopCents: 0,
        reimbursedCents: 0,
        pendingCents: 0,
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const ex of inputs.expenses) {
    if (ex.employeeId !== inputs.employeeId) continue;
    if (!ex.jobId) continue;
    if (ex.receiptDate > asOf) continue;
    const a = getAcc(ex.jobId);
    a.count += 1;
    a.cents += ex.amountCents;
    a.vendors.add(canonVendor(ex.vendor));
    if (!ex.paidWithCompanyCard) {
      a.oopReceipts += 1;
      a.oopCents += ex.amountCents;
      if (ex.reimbursed) a.reimbursedCents += ex.amountCents;
      else a.pendingCents += ex.amountCents;
    }
    if (a.lastDate == null || ex.receiptDate > a.lastDate) a.lastDate = ex.receiptDate;
  }

  const rows: EmployeeExpenseDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      receiptCount: a.count,
      totalCents: a.cents,
      distinctVendors: a.vendors.size,
      oopReceipts: a.oopReceipts,
      oopCents: a.oopCents,
      reimbursedCents: a.reimbursedCents,
      pendingCents: a.pendingCents,
      lastReceiptDate: a.lastDate,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    employeeId: inputs.employeeId,
    rows,
  };
}
