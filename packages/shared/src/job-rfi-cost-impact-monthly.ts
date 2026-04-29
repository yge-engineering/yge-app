// Per (job, month) RFI cost-impact + schedule-impact rate.
//
// Plain English: bucket answered RFIs by (jobId, yyyy-mm of
// answeredAt) and compute cost / schedule impact RATES (count
// of impact-flagged answers / total answered). Tracks how
// design risk evolves on a job over its life.
//
// Per row: jobId, month, answered, costImpactCount,
// scheduleImpactCount, costImpactRate, scheduleImpactRate.
//
// Sort: jobId asc, month asc.
//
// Different from job-rfi-impact-summary (per-job rollup),
// rfi-priority-monthly (priority axis), job-rfi-monthly (per
// (job, month) volume but no rate math).
//
// Pure derivation. No persisted records.

import type { Rfi } from './rfi';

export interface JobRfiCostImpactMonthlyRow {
  jobId: string;
  month: string;
  answered: number;
  costImpactCount: number;
  scheduleImpactCount: number;
  costImpactRate: number;
  scheduleImpactRate: number;
}

export interface JobRfiCostImpactMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalAnswered: number;
}

export interface JobRfiCostImpactMonthlyInputs {
  rfis: Rfi[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobRfiCostImpactMonthly(
  inputs: JobRfiCostImpactMonthlyInputs,
): {
  rollup: JobRfiCostImpactMonthlyRollup;
  rows: JobRfiCostImpactMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    answered: number;
    cost: number;
    schedule: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalAnswered = 0;

  for (const r of inputs.rfis) {
    if (r.status !== 'ANSWERED' && r.status !== 'CLOSED') continue;
    if (!r.answeredAt) continue;
    const month = r.answeredAt.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${r.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: r.jobId,
      month,
      answered: 0,
      cost: 0,
      schedule: 0,
    };
    acc.answered += 1;
    if (r.costImpact) acc.cost += 1;
    if (r.scheduleImpact) acc.schedule += 1;
    accs.set(key, acc);
    jobSet.add(r.jobId);
    monthSet.add(month);
    totalAnswered += 1;
  }

  const rows: JobRfiCostImpactMonthlyRow[] = [];
  for (const acc of accs.values()) {
    const costRate = acc.answered === 0
      ? 0
      : Math.round((acc.cost / acc.answered) * 10_000) / 10_000;
    const schedRate = acc.answered === 0
      ? 0
      : Math.round((acc.schedule / acc.answered) * 10_000) / 10_000;
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      answered: acc.answered,
      costImpactCount: acc.cost,
      scheduleImpactCount: acc.schedule,
      costImpactRate: costRate,
      scheduleImpactRate: schedRate,
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
      totalAnswered,
    },
    rows,
  };
}
