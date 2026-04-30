// Job-anchored submittal year-over-year.
//
// Plain English: for one job, collapse two years of submittals
// into a comparison: counts, status mix, blocks-ordering count,
// distinct authors, plus deltas.
//
// Pure derivation. No persisted records.

import type { Submittal, SubmittalStatus } from './submittal';

export interface JobSubmittalYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByStatus: Partial<Record<SubmittalStatus, number>>;
  priorBlocksOrdering: number;
  priorDistinctAuthors: number;
  currentTotal: number;
  currentByStatus: Partial<Record<SubmittalStatus, number>>;
  currentBlocksOrdering: number;
  currentDistinctAuthors: number;
  totalDelta: number;
}

export interface JobSubmittalYoyInputs {
  jobId: string;
  submittals: Submittal[];
  currentYear: number;
}

export function buildJobSubmittalYoy(inputs: JobSubmittalYoyInputs): JobSubmittalYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    byStatus: Map<SubmittalStatus, number>;
    blocksOrdering: number;
    authors: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, byStatus: new Map(), blocksOrdering: 0, authors: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const s of inputs.submittals) {
    if (s.jobId !== inputs.jobId) continue;
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
    if (s.submittedByEmployeeId) b.authors.add(s.submittedByEmployeeId);
  }

  function statusRecord(m: Map<SubmittalStatus, number>): Partial<Record<SubmittalStatus, number>> {
    const out: Partial<Record<SubmittalStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByStatus: statusRecord(prior.byStatus),
    priorBlocksOrdering: prior.blocksOrdering,
    priorDistinctAuthors: prior.authors.size,
    currentTotal: current.total,
    currentByStatus: statusRecord(current.byStatus),
    currentBlocksOrdering: current.blocksOrdering,
    currentDistinctAuthors: current.authors.size,
    totalDelta: current.total - prior.total,
  };
}
