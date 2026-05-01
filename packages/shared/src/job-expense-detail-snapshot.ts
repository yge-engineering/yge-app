// Job-anchored per-category expense detail snapshot.
//
// Plain English: for one job, return one row per expense category
// (material, fuel, lodging, etc.): receipt count, total cents,
// distinct vendors, distinct employees, reimbursable count + cents,
// last receipt date. Sorted by total cents desc.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';

export interface JobExpenseDetailRow {
  category: string;
  receiptCount: number;
  totalCents: number;
  distinctVendors: number;
  distinctEmployees: number;
  oopCount: number;
  oopCents: number;
  reimbursedCents: number;
  pendingCents: number;
  lastReceiptDate: string | null;
}

export interface JobExpenseDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobExpenseDetailRow[];
}

export interface JobExpenseDetailSnapshotInputs {
  jobId: string;
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

export function buildJobExpenseDetailSnapshot(
  inputs: JobExpenseDetailSnapshotInputs,
): JobExpenseDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    count: number;
    cents: number;
    vendors: Set<string>;
    employees: Set<string>;
    oopCount: number;
    oopCents: number;
    reimbursedCents: number;
    pendingCents: number;
    lastDate: string | null;
  };
  const byCategory = new Map<string, Acc>();
  function getAcc(cat: string): Acc {
    let a = byCategory.get(cat);
    if (!a) {
      a = {
        count: 0,
        cents: 0,
        vendors: new Set(),
        employees: new Set(),
        oopCount: 0,
        oopCents: 0,
        reimbursedCents: 0,
        pendingCents: 0,
        lastDate: null,
      };
      byCategory.set(cat, a);
    }
    return a;
  }

  for (const ex of inputs.expenses) {
    if (ex.jobId !== inputs.jobId) continue;
    if (ex.receiptDate > asOf) continue;
    const a = getAcc(ex.category);
    a.count += 1;
    a.cents += ex.amountCents;
    a.vendors.add(canonVendor(ex.vendor));
    a.employees.add(ex.employeeId);
    if (!ex.paidWithCompanyCard) {
      a.oopCount += 1;
      a.oopCents += ex.amountCents;
      if (ex.reimbursed) a.reimbursedCents += ex.amountCents;
      else a.pendingCents += ex.amountCents;
    }
    if (a.lastDate == null || ex.receiptDate > a.lastDate) a.lastDate = ex.receiptDate;
  }

  const rows: JobExpenseDetailRow[] = [...byCategory.entries()]
    .map(([category, a]) => ({
      category,
      receiptCount: a.count,
      totalCents: a.cents,
      distinctVendors: a.vendors.size,
      distinctEmployees: a.employees.size,
      oopCount: a.oopCount,
      oopCents: a.oopCents,
      reimbursedCents: a.reimbursedCents,
      pendingCents: a.pendingCents,
      lastReceiptDate: a.lastDate,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
