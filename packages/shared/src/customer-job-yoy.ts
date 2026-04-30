// Customer-anchored job year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency
// + bidDueDate year), collapse two years of job records into a
// comparison: total jobs, status mix, plus deltas.
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface CustomerJobYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByStatus: Partial<Record<JobStatus, number>>;
  currentTotal: number;
  currentByStatus: Partial<Record<JobStatus, number>>;
  totalDelta: number;
}

export interface CustomerJobYoyInputs {
  customerName: string;
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerJobYoy(inputs: CustomerJobYoyInputs): CustomerJobYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  type Bucket = { total: number; byStatus: Map<JobStatus, number> };
  function emptyBucket(): Bucket {
    return { total: 0, byStatus: new Map() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) !== target) continue;
    if (!j.bidDueDate || !/^\d{4}/.test(j.bidDueDate)) continue;
    const year = Number(j.bidDueDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const status: JobStatus = j.status ?? 'PURSUING';
    b.byStatus.set(status, (b.byStatus.get(status) ?? 0) + 1);
  }

  function statusRecord(m: Map<JobStatus, number>): Partial<Record<JobStatus, number>> {
    const out: Partial<Record<JobStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByStatus: statusRecord(prior.byStatus),
    currentTotal: current.total,
    currentByStatus: statusRecord(current.byStatus),
    totalDelta: current.total - prior.total,
  };
}
