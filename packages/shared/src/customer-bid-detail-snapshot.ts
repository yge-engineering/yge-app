// Customer-anchored per-bid detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per bid pursuit (Job): project name, status,
// bid due date, engineer's estimate cents. Sorted by bid due
// date descending so the most recent come first.
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface CustomerBidDetailRow {
  jobId: string;
  projectName: string;
  status: JobStatus;
  bidDueDate: string | undefined;
  engineersEstimateCents: number | undefined;
}

export interface CustomerBidDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerBidDetailRow[];
}

export interface CustomerBidDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

export function buildCustomerBidDetailSnapshot(
  inputs: CustomerBidDetailSnapshotInputs,
): CustomerBidDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const rows: CustomerBidDetailRow[] = inputs.jobs
    .filter((j) => norm(j.ownerAgency) === target)
    .map((j) => ({
      jobId: j.id,
      projectName: j.projectName,
      status: j.status ?? 'PURSUING',
      bidDueDate: j.bidDueDate,
      engineersEstimateCents: j.engineersEstimateCents,
    }))
    .sort((a, b) => {
      const aDue = a.bidDueDate ?? '';
      const bDue = b.bidDueDate ?? '';
      if (aDue !== bDue) return bDue.localeCompare(aDue);
      return a.projectName.localeCompare(b.projectName);
    });

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
