// Per-job AP invoice approval cycle time.
//
// Plain English: for each AWARDED job, look at every AP
// invoice with both createdAt and approvedAt populated and
// compute the days between. Surfaces median + slowest cycle.
// Long approval cycles eat into prompt-pay discounts and
// strain vendor relationships.
//
// Different from ap-processing-time (portfolio rollup) and
// vendor-payment-velocity (timing buckets). This is the per-job
// approval-bottleneck view.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

export interface JobApApprovalCycleRow {
  jobId: string;
  projectName: string;
  approvedCount: number;
  pendingCount: number;
  medianCycleDays: number | null;
  meanCycleDays: number | null;
  longestCycleDays: number | null;
}

export interface JobApApprovalCycleRollup {
  jobsConsidered: number;
  totalApproved: number;
  totalPending: number;
  blendedMedianDays: number | null;
}

export interface JobApApprovalCycleInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  apInvoices: ApInvoice[];
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
}

export function buildJobApApprovalCycle(
  inputs: JobApApprovalCycleInputs,
): {
  rollup: JobApApprovalCycleRollup;
  rows: JobApApprovalCycleRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const byJob = new Map<string, ApInvoice[]>();
  for (const inv of inputs.apInvoices) {
    if (!inv.jobId) continue;
    const list = byJob.get(inv.jobId) ?? [];
    list.push(inv);
    byJob.set(inv.jobId, list);
  }

  let totalApproved = 0;
  let totalPending = 0;
  const allDays: number[] = [];

  const rows: JobApApprovalCycleRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const invs = byJob.get(j.id) ?? [];
    const days: number[] = [];
    let pending = 0;
    for (const inv of invs) {
      if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
      if (inv.status === 'PENDING') pending += 1;
      if (!inv.approvedAt) continue;
      const created = inv.createdAt.slice(0, 10);
      const approved = inv.approvedAt.slice(0, 10);
      if (created.length < 10 || approved.length < 10) continue;
      const d = daysBetween(created, approved);
      if (d >= 0) {
        days.push(d);
        allDays.push(d);
      }
    }

    days.sort((a, b) => a - b);
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      approvedCount: days.length,
      pendingCount: pending,
      medianCycleDays: computeMedian(days),
      meanCycleDays: days.length === 0
        ? null
        : Math.round((days.reduce((a, c) => a + c, 0) / days.length) * 10) / 10,
      longestCycleDays: days.length === 0 ? null : (days[days.length - 1] ?? null),
    });

    totalApproved += days.length;
    totalPending += pending;
  }

  // Sort: slowest median first; nulls at bottom.
  rows.sort((a, b) => {
    const am = a.medianCycleDays;
    const bm = b.medianCycleDays;
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return bm - am;
  });

  allDays.sort((a, b) => a - b);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalApproved,
      totalPending,
      blendedMedianDays: computeMedian(allDays),
    },
    rows,
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return Math.round(((a + b) / 2) * 10) / 10;
}
