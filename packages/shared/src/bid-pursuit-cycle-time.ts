// Bid pursuit cycle time.
//
// Plain English: when a job lands in the system (createdAt) and
// when the agency wants the bid in their hands (bidDueDate) is
// the pursuit window. Some pursuits get 30 days (you can walk
// the site, price subs, run plans-to-estimate twice). Some get
// 8 days because the project showed up late on a contractors-
// list email. Cramming a real $1M pursuit into 8 days is how a
// firm misses a sub-bid scope and eats it on a CO later.
//
// Per row: jobId, projectName, projectType, bidDueDate,
// daysToWindow (parseable bidDueDate - createdAt slice), bucket:
//   SHORT       — ≤ 7 days
//   NORMAL      — 8-21 days
//   LONG        — 22-45 days
//   VERY_LONG   — > 45 days
//   MISSING     — no bidDueDate or unparseable
//
// Sort by daysToWindow ascending (nulls last).
//
// Different from bid-pursuit-monthly (volume by month),
// job-creation-monthly (volume by createdAt month), and
// bid-pipeline (active list). This is the cycle-length view.
//
// Pure derivation. No persisted records.

import type { Job } from './job';

export type PursuitCycleBucket =
  | 'SHORT'
  | 'NORMAL'
  | 'LONG'
  | 'VERY_LONG'
  | 'MISSING';

export interface BidPursuitCycleRow {
  jobId: string;
  projectName: string;
  projectType: Job['projectType'];
  bidDueDate: string | null;
  daysToWindow: number | null;
  bucket: PursuitCycleBucket;
}

export interface BidPursuitCycleRollup {
  jobsConsidered: number;
  shortCount: number;
  normalCount: number;
  longCount: number;
  veryLongCount: number;
  missingCount: number;
  avgDaysToWindow: number;
}

export interface BidPursuitCycleInputs {
  jobs: Job[];
  /** Optional yyyy-mm-dd window applied to createdAt. */
  fromDate?: string;
  toDate?: string;
}

export function buildBidPursuitCycleTime(
  inputs: BidPursuitCycleInputs,
): {
  rollup: BidPursuitCycleRollup;
  rows: BidPursuitCycleRow[];
} {
  const rows: BidPursuitCycleRow[] = [];
  let short = 0;
  let normal = 0;
  let long = 0;
  let veryLong = 0;
  let missing = 0;
  let daysSum = 0;
  let daysCount = 0;

  for (const j of inputs.jobs) {
    if (j.status === 'ARCHIVED') continue;
    const created = j.createdAt.slice(0, 10);
    if (inputs.fromDate && created < inputs.fromDate) continue;
    if (inputs.toDate && created > inputs.toDate) continue;
    const due = parseYmd(j.bidDueDate);
    let bucket: PursuitCycleBucket;
    let days: number | null = null;
    if (!due) {
      bucket = 'MISSING';
      missing += 1;
    } else {
      days = daysBetween(created, due);
      if (days <= 7) {
        bucket = 'SHORT';
        short += 1;
      } else if (days <= 21) {
        bucket = 'NORMAL';
        normal += 1;
      } else if (days <= 45) {
        bucket = 'LONG';
        long += 1;
      } else {
        bucket = 'VERY_LONG';
        veryLong += 1;
      }
      daysSum += days;
      daysCount += 1;
    }
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      projectType: j.projectType,
      bidDueDate: j.bidDueDate ?? null,
      daysToWindow: days,
      bucket,
    });
  }

  rows.sort((a, b) => {
    if (a.daysToWindow == null && b.daysToWindow == null) return 0;
    if (a.daysToWindow == null) return 1;
    if (b.daysToWindow == null) return -1;
    return a.daysToWindow - b.daysToWindow;
  });

  const avg = daysCount === 0
    ? 0
    : Math.round((daysSum / daysCount) * 100) / 100;

  return {
    rollup: {
      jobsConsidered: rows.length,
      shortCount: short,
      normalCount: normal,
      longCount: long,
      veryLongCount: veryLong,
      missingCount: missing,
      avgDaysToWindow: avg,
    },
    rows,
  };
}

function parseYmd(s: string | undefined | null): string | null {
  if (!s) return null;
  // Accept any date Date.parse handles; normalize to yyyy-mm-dd UTC.
  const t = Date.parse(s);
  if (Number.isNaN(t)) {
    // Best-effort yyyy-mm-dd fragment match.
    const m = /(\d{4}-\d{2}-\d{2})/.exec(s);
    return m && m[1] ? m[1] : null;
  }
  return new Date(t).toISOString().slice(0, 10);
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
