// Per (job, month) PCO volume.
//
// Plain English: bucket PCOs by (jobId, yyyy-mm of noticedOn).
// Long-format. Useful for tracing PCO velocity on a single
// project over its life.
//
// Per row: jobId, month, total, openCount, convertedCount,
// totalCostImpactCents.
//
// Sort: jobId asc, month asc.
//
// Different from job-pco-summary (per-job rollup), pco-velocity
// (per-PCO timing), pco-origin-breakdown (per-origin).
//
// Pure derivation. No persisted records.

import type { Pco, PcoStatus } from './pco';

const OPEN_STATUSES: ReadonlyArray<PcoStatus> = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED_PENDING_CO'];

export interface JobPcoMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  openCount: number;
  convertedCount: number;
  rejectedCount: number;
  totalCostImpactCents: number;
}

export interface JobPcoMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalPcos: number;
}

export interface JobPcoMonthlyInputs {
  pcos: Pco[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobPcoMonthly(
  inputs: JobPcoMonthlyInputs,
): {
  rollup: JobPcoMonthlyRollup;
  rows: JobPcoMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    open: number;
    converted: number;
    rejected: number;
    cost: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalPcos = 0;

  for (const p of inputs.pcos) {
    const month = p.noticedOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${p.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: p.jobId,
      month,
      total: 0,
      open: 0,
      converted: 0,
      rejected: 0,
      cost: 0,
    };
    acc.total += 1;
    if (OPEN_STATUSES.includes(p.status)) {
      acc.open += 1;
      if (p.costImpactCents > 0) acc.cost += p.costImpactCents;
    }
    if (p.status === 'CONVERTED_TO_CO') acc.converted += 1;
    if (p.status === 'REJECTED') acc.rejected += 1;
    accs.set(key, acc);
    jobSet.add(p.jobId);
    monthSet.add(month);
    totalPcos += 1;
  }

  const rows: JobPcoMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      total: acc.total,
      openCount: acc.open,
      convertedCount: acc.converted,
      rejectedCount: acc.rejected,
      totalCostImpactCents: acc.cost,
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
      totalPcos,
    },
    rows,
  };
}
