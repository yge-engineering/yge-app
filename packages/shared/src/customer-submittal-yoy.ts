// Customer-anchored submittal year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of submittal records into a comparison:
// counts, status mix, blocks-ordering count, distinct jobs +
// authors, plus deltas.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Submittal, SubmittalStatus } from './submittal';

export interface CustomerSubmittalYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByStatus: Partial<Record<SubmittalStatus, number>>;
  priorBlocksOrdering: number;
  priorDistinctJobs: number;
  priorDistinctAuthors: number;
  currentTotal: number;
  currentByStatus: Partial<Record<SubmittalStatus, number>>;
  currentBlocksOrdering: number;
  currentDistinctJobs: number;
  currentDistinctAuthors: number;
  totalDelta: number;
}

export interface CustomerSubmittalYoyInputs {
  customerName: string;
  submittals: Submittal[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerSubmittalYoy(
  inputs: CustomerSubmittalYoyInputs,
): CustomerSubmittalYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    total: number;
    byStatus: Map<SubmittalStatus, number>;
    blocksOrdering: number;
    jobs: Set<string>;
    authors: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, byStatus: new Map(), blocksOrdering: 0, jobs: new Set(), authors: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const s of inputs.submittals) {
    if (!customerJobs.has(s.jobId)) continue;
    const dt = s.submittedAt ?? s.createdAt;
    if (!dt) continue;
    const year = Number(dt.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const status: SubmittalStatus = s.status ?? 'DRAFT';
    b.byStatus.set(status, (b.byStatus.get(status) ?? 0) + 1);
    if (s.blocksOrdering) b.blocksOrdering += 1;
    b.jobs.add(s.jobId);
    if (s.submittedByEmployeeId) b.authors.add(s.submittedByEmployeeId);
  }

  function statusRecord(m: Map<SubmittalStatus, number>): Partial<Record<SubmittalStatus, number>> {
    const out: Partial<Record<SubmittalStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByStatus: statusRecord(prior.byStatus),
    priorBlocksOrdering: prior.blocksOrdering,
    priorDistinctJobs: prior.jobs.size,
    priorDistinctAuthors: prior.authors.size,
    currentTotal: current.total,
    currentByStatus: statusRecord(current.byStatus),
    currentBlocksOrdering: current.blocksOrdering,
    currentDistinctJobs: current.jobs.size,
    currentDistinctAuthors: current.authors.size,
    totalDelta: current.total - prior.total,
  };
}
