// Customer-anchored submittal snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count submittals across all their jobs, status
// mix, open + overdue, blocks-ordering, distinct jobs.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Submittal, SubmittalStatus } from './submittal';

export interface CustomerSubmittalSnapshotResult {
  asOf: string;
  customerName: string;
  totalSubmittals: number;
  byStatus: Partial<Record<SubmittalStatus, number>>;
  openCount: number;
  overdueCount: number;
  blocksOrderingCount: number;
  distinctJobs: number;
}

export interface CustomerSubmittalSnapshotInputs {
  customerName: string;
  submittals: Submittal[];
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

export function buildCustomerSubmittalSnapshot(
  inputs: CustomerSubmittalSnapshotInputs,
): CustomerSubmittalSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const jobIds = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) jobIds.add(j.id);
  }

  const byStatus = new Map<SubmittalStatus, number>();
  const jobs = new Set<string>();

  let totalSubmittals = 0;
  let openCount = 0;
  let overdueCount = 0;
  let blocksOrderingCount = 0;

  for (const s of inputs.submittals) {
    if (!jobIds.has(s.jobId)) continue;
    totalSubmittals += 1;
    const status: SubmittalStatus = s.status ?? 'DRAFT';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    const isOpen = status === 'DRAFT' || status === 'SUBMITTED' || status === 'REVISE_RESUBMIT';
    if (isOpen) {
      openCount += 1;
      if (s.responseDueAt && s.responseDueAt < asOf && !s.returnedAt) overdueCount += 1;
    }
    if (s.blocksOrdering) blocksOrderingCount += 1;
    jobs.add(s.jobId);
  }

  const out: Partial<Record<SubmittalStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalSubmittals,
    byStatus: out,
    openCount,
    overdueCount,
    blocksOrderingCount,
    distinctJobs: jobs.size,
  };
}
