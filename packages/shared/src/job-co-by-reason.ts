// Per-job CO breakdown by reason.
//
// Plain English: bucket COs by (jobId, ChangeOrderReason) —
// OWNER_DIRECTED / DIFFERING_SITE_CONDITION / DESIGN_REVISION /
// RFI_RESPONSE / CODE_REVISION / WEATHER_OR_DELAY /
// SCOPE_CLARIFICATION / OTHER. Useful for "what kind of CO
// activity is hitting this job."
//
// Per row: jobId, reason, total, executedCount, totalCostImpactCents,
// totalScheduleImpactDays.
//
// Sort: jobId asc, totalCostImpactCents desc within job.
//
// Different from co-origin-monthly (per month + reason, no job
// axis), job-co-summary (per-job totals, no reason axis),
// pco-origin-breakdown (PCO side).
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderReason } from './change-order';

export interface JobCoByReasonRow {
  jobId: string;
  reason: ChangeOrderReason;
  total: number;
  executedCount: number;
  totalCostImpactCents: number;
  totalScheduleImpactDays: number;
}

export interface JobCoByReasonRollup {
  jobsConsidered: number;
  reasonsConsidered: number;
  totalCos: number;
}

export interface JobCoByReasonInputs {
  changeOrders: ChangeOrder[];
  /** Optional yyyy-mm-dd window applied to executedAt or
   *  approvedAt fallback. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobCoByReason(
  inputs: JobCoByReasonInputs,
): {
  rollup: JobCoByReasonRollup;
  rows: JobCoByReasonRow[];
} {
  type Acc = {
    jobId: string;
    reason: ChangeOrderReason;
    total: number;
    executed: number;
    cost: number;
    days: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const reasonSet = new Set<ChangeOrderReason>();
  let totalCos = 0;

  for (const co of inputs.changeOrders) {
    const ref = co.executedAt ?? co.approvedAt ?? co.proposedAt;
    if (inputs.fromDate && ref && ref < inputs.fromDate) continue;
    if (inputs.toDate && ref && ref > inputs.toDate) continue;
    const key = `${co.jobId}|${co.reason}`;
    const acc = accs.get(key) ?? {
      jobId: co.jobId,
      reason: co.reason,
      total: 0,
      executed: 0,
      cost: 0,
      days: 0,
    };
    acc.total += 1;
    if (co.status === 'EXECUTED' || co.status === 'APPROVED') {
      acc.executed += 1;
      acc.cost += co.totalCostImpactCents;
      acc.days += co.totalScheduleImpactDays;
    }
    accs.set(key, acc);
    jobSet.add(co.jobId);
    reasonSet.add(co.reason);
    totalCos += 1;
  }

  const rows: JobCoByReasonRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      reason: acc.reason,
      total: acc.total,
      executedCount: acc.executed,
      totalCostImpactCents: acc.cost,
      totalScheduleImpactDays: acc.days,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return b.totalCostImpactCents - a.totalCostImpactCents;
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      reasonsConsidered: reasonSet.size,
      totalCos,
    },
    rows,
  };
}
