// Per-job AP processing pipeline.
//
// Plain English: ap-check-run gives the company-wide weekly check
// run. This module flips it per AWARDED job — what's the AP queue
// look like for this specific project? Useful for project-detail
// pages and pre-billing reviews where the PM wants to know how
// much vendor cost is in flight on their job.
//
// Per row:
//   - count + total $ in PENDING (awaiting approval)
//   - count + total $ in APPROVED (next check run)
//   - count + total $ in PAID (already out the door)
//   - count of REJECTED/DRAFT (visibility only)
//   - unpaidBalance against the job (PENDING + APPROVED unpaid)
//   - days since the most recent paid invoice
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

export interface JobApPipelineRow {
  jobId: string;
  projectName: string;
  pendingCount: number;
  pendingTotalCents: number;
  approvedCount: number;
  approvedTotalCents: number;
  paidCount: number;
  paidTotalCents: number;
  rejectedCount: number;
  draftCount: number;
  /** Unpaid balance: PENDING + APPROVED, totalCents - paidCents. */
  unpaidBalanceCents: number;
  /** Most recent paidAt date across PAID invoices. Null when none. */
  lastPaidAt: string | null;
  daysSinceLastPaid: number | null;
}

export interface JobApPipelineRollup {
  jobsConsidered: number;
  totalPendingCents: number;
  totalApprovedCents: number;
  totalPaidCents: number;
  totalUnpaidBalanceCents: number;
}

export interface JobApPipelineInputs {
  asOf?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  apInvoices: ApInvoice[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobApPipeline(
  inputs: JobApPipelineInputs,
): {
  rollup: JobApPipelineRollup;
  rows: JobApPipelineRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const includeAll = inputs.includeAllStatuses === true;

  const byJob = new Map<string, ApInvoice[]>();
  for (const inv of inputs.apInvoices) {
    if (!inv.jobId) continue;
    const list = byJob.get(inv.jobId) ?? [];
    list.push(inv);
    byJob.set(inv.jobId, list);
  }

  const rows: JobApPipelineRow[] = [];
  let totalPending = 0;
  let totalApproved = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const invs = byJob.get(j.id) ?? [];
    let pendingCount = 0;
    let pendingTotal = 0;
    let approvedCount = 0;
    let approvedTotal = 0;
    let paidCount = 0;
    let paidTotal = 0;
    let rejected = 0;
    let draft = 0;
    let unpaid = 0;
    let lastPaidAt: string | null = null;

    for (const inv of invs) {
      const open = Math.max(0, inv.totalCents - inv.paidCents);
      if (inv.status === 'PENDING') {
        pendingCount += 1;
        pendingTotal += inv.totalCents;
        unpaid += open;
      } else if (inv.status === 'APPROVED') {
        approvedCount += 1;
        approvedTotal += inv.totalCents;
        unpaid += open;
      } else if (inv.status === 'PAID') {
        paidCount += 1;
        paidTotal += inv.totalCents;
        if (inv.paidAt) {
          const head = inv.paidAt.slice(0, 10);
          if (!lastPaidAt || head > lastPaidAt) lastPaidAt = head;
        }
      } else if (inv.status === 'REJECTED') {
        rejected += 1;
      } else if (inv.status === 'DRAFT') {
        draft += 1;
      }
    }

    let daysSinceLastPaid: number | null = null;
    if (lastPaidAt) {
      const d = parseDate(lastPaidAt);
      if (d) daysSinceLastPaid = Math.max(0, daysBetween(d, refNow));
    }

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      pendingCount,
      pendingTotalCents: pendingTotal,
      approvedCount,
      approvedTotalCents: approvedTotal,
      paidCount,
      paidTotalCents: paidTotal,
      rejectedCount: rejected,
      draftCount: draft,
      unpaidBalanceCents: unpaid,
      lastPaidAt,
      daysSinceLastPaid,
    });

    totalPending += pendingTotal;
    totalApproved += approvedTotal;
    totalPaid += paidTotal;
    totalUnpaid += unpaid;
  }

  // Highest unpaid balance first — the most pressing AP commitment.
  rows.sort((a, b) => b.unpaidBalanceCents - a.unpaidBalanceCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalPendingCents: totalPending,
      totalApprovedCents: totalApproved,
      totalPaidCents: totalPaid,
      totalUnpaidBalanceCents: totalUnpaid,
    },
    rows,
  };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
