// Customer-anchored job footprint snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count their jobs with status mix: prospects,
// pursuing, awarded/active, lost, no-bid, archived. Surface
// recent + upcoming activity counts.
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface CustomerJobSnapshotResult {
  asOf: string;
  customerName: string;
  totalJobs: number;
  byStatus: Partial<Record<JobStatus, number>>;
  activeJobs: number;
  archivedJobs: number;
}

export interface CustomerJobSnapshotInputs {
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

export function buildCustomerJobSnapshot(inputs: CustomerJobSnapshotInputs): CustomerJobSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const byStatus = new Map<JobStatus, number>();
  let totalJobs = 0;
  let activeJobs = 0;
  let archivedJobs = 0;

  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) !== target) continue;
    totalJobs += 1;
    const status: JobStatus = j.status ?? 'PURSUING';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    if (status === 'AWARDED') activeJobs += 1;
    else if (status === 'ARCHIVED') archivedJobs += 1;
  }

  const out: Partial<Record<JobStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalJobs,
    byStatus: out,
    activeJobs,
    archivedJobs,
  };
}
