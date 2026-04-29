// Per-job PCO summary.
//
// Plain English: roll PCO records up by jobId — open count, total
// cost exposure (positive impacts only on open status), executed
// count (linked to a CO), rejected, status mix.
//
// Per row: jobId, total, open (SUBMITTED + UNDER_REVIEW +
// APPROVED_PENDING_CO + DRAFT), submitted, underReview,
// approvedPendingCo, rejected, withdrawn, convertedToCo,
// totalOpenCostImpactCents, totalScheduleImpactDays,
// distinctOrigins.
//
// Sort by totalOpenCostImpactCents desc.
//
// Different from pco-exposure (portfolio total open exposure),
// pco-velocity (timing), pco-vs-co-analysis (PCO → CO variance).
//
// Pure derivation. No persisted records.

import type { Pco, PcoOrigin, PcoStatus } from './pco';

export interface JobPcoSummaryRow {
  jobId: string;
  total: number;
  draft: number;
  submitted: number;
  underReview: number;
  approvedPendingCo: number;
  rejected: number;
  withdrawn: number;
  convertedToCo: number;
  open: number;
  totalOpenCostImpactCents: number;
  totalScheduleImpactDays: number;
  distinctOrigins: number;
}

export interface JobPcoSummaryRollup {
  jobsConsidered: number;
  totalPcos: number;
  totalOpenCostImpactCents: number;
}

export interface JobPcoSummaryInputs {
  pcos: Pco[];
  /** Optional yyyy-mm-dd window applied to noticedOn. */
  fromDate?: string;
  toDate?: string;
}

const OPEN_STATUSES: PcoStatus[] = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED_PENDING_CO'];

export function buildJobPcoSummary(
  inputs: JobPcoSummaryInputs,
): {
  rollup: JobPcoSummaryRollup;
  rows: JobPcoSummaryRow[];
} {
  type Acc = {
    jobId: string;
    counts: Record<PcoStatus, number>;
    openCost: number;
    scheduleDays: number;
    origins: Set<PcoOrigin>;
  };
  const accs = new Map<string, Acc>();
  let totalPcos = 0;
  let totalOpenCost = 0;

  for (const p of inputs.pcos) {
    if (inputs.fromDate && p.noticedOn < inputs.fromDate) continue;
    if (inputs.toDate && p.noticedOn > inputs.toDate) continue;
    totalPcos += 1;
    const acc = accs.get(p.jobId) ?? {
      jobId: p.jobId,
      counts: {
        DRAFT: 0,
        SUBMITTED: 0,
        UNDER_REVIEW: 0,
        APPROVED_PENDING_CO: 0,
        REJECTED: 0,
        WITHDRAWN: 0,
        CONVERTED_TO_CO: 0,
      },
      openCost: 0,
      scheduleDays: 0,
      origins: new Set<PcoOrigin>(),
    };
    acc.counts[p.status] += 1;
    if (OPEN_STATUSES.includes(p.status) && p.costImpactCents > 0) {
      acc.openCost += p.costImpactCents;
      totalOpenCost += p.costImpactCents;
    }
    acc.scheduleDays += p.scheduleImpactDays;
    acc.origins.add(p.origin);
    accs.set(p.jobId, acc);
  }

  const rows: JobPcoSummaryRow[] = [];
  for (const acc of accs.values()) {
    const open = OPEN_STATUSES.reduce((sum, s) => sum + acc.counts[s], 0);
    let total = 0;
    for (const v of Object.values(acc.counts)) total += v;
    rows.push({
      jobId: acc.jobId,
      total,
      draft: acc.counts.DRAFT,
      submitted: acc.counts.SUBMITTED,
      underReview: acc.counts.UNDER_REVIEW,
      approvedPendingCo: acc.counts.APPROVED_PENDING_CO,
      rejected: acc.counts.REJECTED,
      withdrawn: acc.counts.WITHDRAWN,
      convertedToCo: acc.counts.CONVERTED_TO_CO,
      open,
      totalOpenCostImpactCents: acc.openCost,
      totalScheduleImpactDays: acc.scheduleDays,
      distinctOrigins: acc.origins.size,
    });
  }

  rows.sort((a, b) => b.totalOpenCostImpactCents - a.totalOpenCostImpactCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalPcos,
      totalOpenCostImpactCents: totalOpenCost,
    },
    rows,
  };
}
