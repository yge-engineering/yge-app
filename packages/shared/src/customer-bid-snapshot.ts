// Customer-anchored bid pursuit snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count jobs in the pursuit pipeline, status mix,
// awarded/lost/no-bid/in-flight counts, win rate to date,
// upcoming due in next N days. Drives the right-now per-
// customer estimating-pipeline overview.
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface CustomerBidSnapshotResult {
  asOf: string;
  customerName: string;
  totalJobs: number;
  ytdBidsDue: number;
  awardedCount: number;
  lostCount: number;
  noBidCount: number;
  inFlightCount: number;
  upcomingDueCount: number;
  /** awarded / (awarded + lost + noBid). Null if denominator is 0. */
  winRate: number | null;
  byStatus: Partial<Record<JobStatus, number>>;
}

export interface CustomerBidSnapshotInputs {
  customerName: string;
  jobs: Job[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year. Defaults to year of asOf. */
  logYear?: number;
  /** Days ahead to count "upcoming due" (default 14). */
  upcomingWindowDays?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerBidSnapshot(
  inputs: CustomerBidSnapshotInputs,
): CustomerBidSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));
  const windowDays = inputs.upcomingWindowDays ?? 14;
  const upcomingTo = addDays(asOf, windowDays);
  const target = norm(inputs.customerName);

  const byStatus = new Map<JobStatus, number>();
  let totalJobs = 0;
  let ytdBidsDue = 0;
  let awardedCount = 0;
  let lostCount = 0;
  let noBidCount = 0;
  let inFlightCount = 0;
  let upcomingDueCount = 0;

  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) !== target) continue;
    totalJobs += 1;
    const status: JobStatus = j.status ?? 'PURSUING';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    if (status === 'AWARDED') awardedCount += 1;
    else if (status === 'LOST') lostCount += 1;
    else if (status === 'NO_BID') noBidCount += 1;
    else if (status === 'PROSPECT' || status === 'PURSUING' || status === 'BID_SUBMITTED') {
      inFlightCount += 1;
    }
    if (j.bidDueDate) {
      if (j.bidDueDate.slice(0, 4) === String(logYear) && j.bidDueDate <= asOf) {
        ytdBidsDue += 1;
      }
      if (j.bidDueDate >= asOf && j.bidDueDate <= upcomingTo) {
        upcomingDueCount += 1;
      }
    }
  }

  const decided = awardedCount + lostCount + noBidCount;
  const winRate = decided > 0 ? awardedCount / decided : null;

  const out: Partial<Record<JobStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalJobs,
    ytdBidsDue,
    awardedCount,
    lostCount,
    noBidCount,
    inFlightCount,
    upcomingDueCount,
    winRate,
    byStatus: out,
  };
}
