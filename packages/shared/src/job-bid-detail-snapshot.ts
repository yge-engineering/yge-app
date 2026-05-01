// Job-anchored per-bidder bid result detail snapshot.
//
// Plain English: for one job, return one row per bidder who showed
// up on any of the agency's bid tabulations: bid count (in case
// the job was re-bid), low bid cents, high bid cents, average bid
// cents, last appearance date. YGE's row is flagged. Sorted by
// average bid asc.
//
// Pure derivation. No persisted records.

import type { BidResult } from './bid-result';

export interface JobBidDetailRow {
  bidderName: string;
  isYge: boolean;
  bidCount: number;
  lowBidCents: number;
  highBidCents: number;
  avgBidCents: number;
  lastBidDate: string | null;
}

export interface JobBidDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobBidDetailRow[];
}

export interface JobBidDetailSnapshotInputs {
  jobId: string;
  bidResults: BidResult[];
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

function canonName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function buildJobBidDetailSnapshot(
  inputs: JobBidDetailSnapshotInputs,
): JobBidDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    name: string;
    isYge: boolean;
    count: number;
    low: number;
    high: number;
    sum: number;
    lastDate: string | null;
  };
  const byBidder = new Map<string, Acc>();
  function getAcc(name: string, isYge: boolean): Acc {
    const key = canonName(name);
    let a = byBidder.get(key);
    if (!a) {
      a = { name, isYge, count: 0, low: Number.MAX_SAFE_INTEGER, high: 0, sum: 0, lastDate: null };
      byBidder.set(key, a);
    }
    if (isYge) a.isYge = true;
    return a;
  }

  for (const br of inputs.bidResults) {
    if (br.jobId !== inputs.jobId) continue;
    if (br.bidOpenedAt > asOf) continue;
    for (const b of br.bidders) {
      const a = getAcc(b.bidderName, b.isYge);
      a.count += 1;
      if (b.amountCents < a.low) a.low = b.amountCents;
      if (b.amountCents > a.high) a.high = b.amountCents;
      a.sum += b.amountCents;
      if (a.lastDate == null || br.bidOpenedAt > a.lastDate) a.lastDate = br.bidOpenedAt;
    }
  }

  const rows: JobBidDetailRow[] = [...byBidder.values()]
    .map((a) => ({
      bidderName: a.name,
      isYge: a.isYge,
      bidCount: a.count,
      lowBidCents: a.count === 0 ? 0 : a.low,
      highBidCents: a.high,
      avgBidCents: a.count === 0 ? 0 : Math.round(a.sum / a.count),
      lastBidDate: a.lastDate,
    }))
    .sort((a, b) => a.avgBidCents - b.avgBidCents || a.bidderName.localeCompare(b.bidderName));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
