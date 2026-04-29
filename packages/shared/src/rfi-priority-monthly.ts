// RFI volume by month, broken by priority.
//
// Plain English: rfi-monthly-volume already counts RFIs sent +
// answered per month. This is the same time axis but split by
// RfiPriority (LOW / MEDIUM / HIGH / CRITICAL). When the
// CRITICAL count creeps up, design issues are landing late and
// the agency's engineer is the bottleneck.
//
// Per row: month, total, low, medium, high, critical,
// distinctJobs.
//
// Sort by month asc.
//
// Different from rfi-monthly-volume (counts + response time, no
// priority axis), job-rfi-priority-mix (per job), and rfi-board
// (snapshot list).
//
// Pure derivation. No persisted records.

import type { Rfi, RfiPriority } from './rfi';

export interface RfiPriorityMonthlyRow {
  month: string;
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  distinctJobs: number;
}

export interface RfiPriorityMonthlyRollup {
  monthsConsidered: number;
  totalRfis: number;
  totalCritical: number;
  monthOverMonthCriticalChange: number;
}

export interface RfiPriorityMonthlyInputs {
  rfis: Rfi[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildRfiPriorityMonthly(
  inputs: RfiPriorityMonthlyInputs,
): {
  rollup: RfiPriorityMonthlyRollup;
  rows: RfiPriorityMonthlyRow[];
} {
  type Bucket = {
    month: string;
    counts: Record<RfiPriority, number>;
    jobs: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    counts: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    jobs: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const r of inputs.rfis) {
    const ref = r.sentAt ?? r.createdAt.slice(0, 10);
    const month = ref.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.counts[r.priority] += 1;
    b.jobs.add(r.jobId);
    buckets.set(month, b);
  }

  const rows: RfiPriorityMonthlyRow[] = Array.from(buckets.values())
    .map((b) => {
      let total = 0;
      for (const v of Object.values(b.counts)) total += v;
      return {
        month: b.month,
        total,
        low: b.counts.LOW,
        medium: b.counts.MEDIUM,
        high: b.counts.HIGH,
        critical: b.counts.CRITICAL,
        distinctJobs: b.jobs.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let momCritical = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) momCritical = last.critical - prev.critical;
  }

  let totalRfis = 0;
  let totalCritical = 0;
  for (const r of rows) {
    totalRfis += r.total;
    totalCritical += r.critical;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalRfis,
      totalCritical,
      monthOverMonthCriticalChange: momCritical,
    },
    rows,
  };
}
