// Per (job, month) submittal volume.
//
// Plain English: bucket non-draft submittals by (jobId, yyyy-mm
// of submittedAt or createdAt fallback). Long-format. Useful
// for pacing per-job submittal load.
//
// Per row: jobId, month, total, approvedCount, reviseCount,
// pendingCount.
//
// Sort: jobId asc, month asc.
//
// Different from submittal-by-job (per-job rollup, no month
// axis), submittal-monthly-volume (portfolio per month).
//
// Pure derivation. No persisted records.

import type { Submittal } from './submittal';

export interface SubmittalByJobMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  approvedCount: number;
  reviseCount: number;
  pendingCount: number;
}

export interface SubmittalByJobMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalSubmittals: number;
}

export interface SubmittalByJobMonthlyInputs {
  submittals: Submittal[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildSubmittalByJobMonthly(
  inputs: SubmittalByJobMonthlyInputs,
): {
  rollup: SubmittalByJobMonthlyRollup;
  rows: SubmittalByJobMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    approved: number;
    revise: number;
    pending: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalSubmittals = 0;

  for (const s of inputs.submittals) {
    if (s.status === 'DRAFT') continue;
    const ref = s.submittedAt ?? s.createdAt.slice(0, 10);
    const month = ref.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${s.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: s.jobId,
      month,
      total: 0,
      approved: 0,
      revise: 0,
      pending: 0,
    };
    acc.total += 1;
    if (s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED') acc.approved += 1;
    else if (s.status === 'REVISE_RESUBMIT') acc.revise += 1;
    else if (s.status === 'SUBMITTED') acc.pending += 1;
    accs.set(key, acc);
    jobSet.add(s.jobId);
    monthSet.add(month);
    totalSubmittals += 1;
  }

  const rows: SubmittalByJobMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      total: acc.total,
      approvedCount: acc.approved,
      reviseCount: acc.revise,
      pendingCount: acc.pending,
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
      totalSubmittals,
    },
    rows,
  };
}
