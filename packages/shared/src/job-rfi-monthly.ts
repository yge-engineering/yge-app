// Per-job RFI volume by month.
//
// Plain English: bucket RFIs by (jobId, yyyy-mm of sentAt or
// createdAt fallback). Long-format. Useful for tracing how RFI
// activity ramps and tapers over the life of a job.
//
// Per row: jobId, month, total, answered, costImpactCount,
// scheduleImpactCount, distinctAskers.
//
// Sort: jobId asc, month asc.
//
// Different from job-rfi-impact-summary (per job rollup),
// rfi-monthly-volume (portfolio per month), rfi-priority-monthly
// (portfolio with priority axis).
//
// Pure derivation. No persisted records.

import type { Rfi } from './rfi';

export interface JobRfiMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  answered: number;
  costImpactCount: number;
  scheduleImpactCount: number;
  distinctAskers: number;
}

export interface JobRfiMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalRfis: number;
}

export interface JobRfiMonthlyInputs {
  rfis: Rfi[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobRfiMonthly(
  inputs: JobRfiMonthlyInputs,
): {
  rollup: JobRfiMonthlyRollup;
  rows: JobRfiMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    answered: number;
    cost: number;
    schedule: number;
    askers: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalRfis = 0;

  for (const r of inputs.rfis) {
    const ref = r.sentAt ?? r.createdAt.slice(0, 10);
    const month = ref.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${r.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: r.jobId,
      month,
      total: 0,
      answered: 0,
      cost: 0,
      schedule: 0,
      askers: new Set<string>(),
    };
    acc.total += 1;
    if (r.status === 'ANSWERED' || r.status === 'CLOSED') acc.answered += 1;
    if (r.costImpact) acc.cost += 1;
    if (r.scheduleImpact) acc.schedule += 1;
    if (r.askedByEmployeeId && r.askedByEmployeeId.trim()) {
      acc.askers.add(r.askedByEmployeeId.trim());
    }
    accs.set(key, acc);
    jobSet.add(r.jobId);
    monthSet.add(month);
    totalRfis += 1;
  }

  const rows: JobRfiMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      total: acc.total,
      answered: acc.answered,
      costImpactCount: acc.cost,
      scheduleImpactCount: acc.schedule,
      distinctAskers: acc.askers.size,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      monthsConsidered: monthSet.size,
      totalRfis,
    },
    rows,
  };
}
