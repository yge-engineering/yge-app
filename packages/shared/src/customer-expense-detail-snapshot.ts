// Customer-anchored per-job expense detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: receipt count, total cents,
// reimbursable / reimbursed / pending cents, distinct employees,
// last receipt date. Sorted by total cents desc.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';
import type { Job } from './job';

import { expenseReimbursableCents } from './expense';

export interface CustomerExpenseDetailRow {
  jobId: string;
  receipts: number;
  totalCents: number;
  reimbursableCents: number;
  reimbursedCents: number;
  pendingReimbursementCents: number;
  distinctEmployees: number;
  lastReceiptDate: string | null;
}

export interface CustomerExpenseDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerExpenseDetailRow[];
}

export interface CustomerExpenseDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerExpenseDetailSnapshot(
  inputs: CustomerExpenseDetailSnapshotInputs,
): CustomerExpenseDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    receipts: number;
    cents: number;
    reimb: number;
    reimbursed: number;
    pending: number;
    employees: Set<string>;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = {
        receipts: 0,
        cents: 0,
        reimb: 0,
        reimbursed: 0,
        pending: 0,
        employees: new Set(),
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const e of inputs.expenses) {
    if (!e.jobId || !customerJobs.has(e.jobId)) continue;
    if (e.receiptDate > asOf) continue;
    const a = getAcc(e.jobId);
    a.receipts += 1;
    a.cents += e.amountCents;
    const r = expenseReimbursableCents(e);
    a.reimb += r;
    if (e.reimbursed) a.reimbursed += r;
    else a.pending += r;
    a.employees.add(e.employeeId);
    if (a.lastDate == null || e.receiptDate > a.lastDate) a.lastDate = e.receiptDate;
  }

  const rows: CustomerExpenseDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      receipts: a.receipts,
      totalCents: a.cents,
      reimbursableCents: a.reimb,
      reimbursedCents: a.reimbursed,
      pendingReimbursementCents: a.pending,
      distinctEmployees: a.employees.size,
      lastReceiptDate: a.lastDate,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
