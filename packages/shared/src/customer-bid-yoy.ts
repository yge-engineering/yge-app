// Customer-anchored bid pursuit year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of bid pursuits into a comparison: total
// pursuits, awarded/lost/no-bid, win rate, plus deltas.
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface CustomerBidYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorAwarded: number;
  priorLost: number;
  priorNoBid: number;
  priorByStatus: Partial<Record<JobStatus, number>>;
  priorWinRate: number | null;
  currentTotal: number;
  currentAwarded: number;
  currentLost: number;
  currentNoBid: number;
  currentByStatus: Partial<Record<JobStatus, number>>;
  currentWinRate: number | null;
  totalDelta: number;
  winRateDelta: number | null;
}

export interface CustomerBidYoyInputs {
  customerName: string;
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerBidYoy(
  inputs: CustomerBidYoyInputs,
): CustomerBidYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  type Bucket = {
    total: number;
    awarded: number;
    lost: number;
    noBid: number;
    byStatus: Map<JobStatus, number>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, awarded: 0, lost: 0, noBid: 0, byStatus: new Map() };
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
    if (status === 'AWARDED') b.awarded += 1;
    else if (status === 'LOST') b.lost += 1;
    else if (status === 'NO_BID') b.noBid += 1;
  }

  function statusRecord(m: Map<JobStatus, number>): Partial<Record<JobStatus, number>> {
    const out: Partial<Record<JobStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  function winRate(b: Bucket): number | null {
    const decided = b.awarded + b.lost + b.noBid;
    return decided > 0 ? b.awarded / decided : null;
  }

  const priorWin = winRate(prior);
  const currentWin = winRate(current);

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorAwarded: prior.awarded,
    priorLost: prior.lost,
    priorNoBid: prior.noBid,
    priorByStatus: statusRecord(prior.byStatus),
    priorWinRate: priorWin,
    currentTotal: current.total,
    currentAwarded: current.awarded,
    currentLost: current.lost,
    currentNoBid: current.noBid,
    currentByStatus: statusRecord(current.byStatus),
    currentWinRate: currentWin,
    totalDelta: current.total - prior.total,
    winRateDelta: priorWin == null || currentWin == null ? null : currentWin - priorWin,
  };
}
