// Per-job schedule-extension register.
//
// Plain English: change orders carry totalScheduleImpactDays.
// Positive = extension request, negative = acceleration. For
// each AWARDED job, count how many extension-bearing COs exist
// in each status bucket and sum up the days proposed vs. days
// approved.
//
// Different from co-density (count rollup), pco-vs-co-analysis
// (PCO conversion), and job-co-summary (per-job dollars
// rollup). This is the schedule-claim register that supports
// the time-extension argument when the agency pushes back on
// liquidated damages.
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

export interface JobScheduleExtensionsRow {
  jobId: string;
  projectName: string;
  /** Total COs with non-zero schedule impact. */
  withScheduleImpact: number;
  /** Schedule days proposed across PROPOSED + AGENCY_REVIEW
   *  + APPROVED + EXECUTED COs. */
  proposedDays: number;
  /** Schedule days approved (APPROVED + EXECUTED only). */
  approvedDays: number;
  /** Pending — proposed but not yet decided. */
  pendingDays: number;
  /** Rejected — schedule days the agency refused. */
  rejectedDays: number;
  acceleratedDays: number;
}

export interface JobScheduleExtensionsRollup {
  jobsConsidered: number;
  totalProposedDays: number;
  totalApprovedDays: number;
  totalPendingDays: number;
  totalRejectedDays: number;
  totalAcceleratedDays: number;
}

export interface JobScheduleExtensionsInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  changeOrders: ChangeOrder[];
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
}

export function buildJobScheduleExtensions(
  inputs: JobScheduleExtensionsInputs,
): {
  rollup: JobScheduleExtensionsRollup;
  rows: JobScheduleExtensionsRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const cosByJob = new Map<string, ChangeOrder[]>();
  for (const co of inputs.changeOrders) {
    const list = cosByJob.get(co.jobId) ?? [];
    list.push(co);
    cosByJob.set(co.jobId, list);
  }

  let totalProposed = 0;
  let totalApproved = 0;
  let totalPending = 0;
  let totalRejected = 0;
  let totalAccel = 0;

  const rows: JobScheduleExtensionsRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const cos = cosByJob.get(j.id) ?? [];
    let withImpact = 0;
    let proposed = 0;
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let accelerated = 0;

    for (const co of cos) {
      const days = co.totalScheduleImpactDays;
      if (days === 0) continue;
      withImpact += 1;
      if (days < 0) {
        accelerated += -days;
        continue;
      }
      // Positive = extension request.
      if (co.status === 'PROPOSED' || co.status === 'AGENCY_REVIEW') {
        proposed += days;
        pending += days;
      } else if (co.status === 'APPROVED' || co.status === 'EXECUTED') {
        proposed += days;
        approved += days;
      } else if (co.status === 'REJECTED') {
        rejected += days;
      }
      // WITHDRAWN: drops out
    }

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      withScheduleImpact: withImpact,
      proposedDays: proposed,
      approvedDays: approved,
      pendingDays: pending,
      rejectedDays: rejected,
      acceleratedDays: accelerated,
    });

    totalProposed += proposed;
    totalApproved += approved;
    totalPending += pending;
    totalRejected += rejected;
    totalAccel += accelerated;
  }

  // Sort jobs by approvedDays desc, then by pendingDays desc.
  rows.sort((a, b) => {
    if (a.approvedDays !== b.approvedDays) return b.approvedDays - a.approvedDays;
    return b.pendingDays - a.pendingDays;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalProposedDays: totalProposed,
      totalApprovedDays: totalApproved,
      totalPendingDays: totalPending,
      totalRejectedDays: totalRejected,
      totalAcceleratedDays: totalAccel,
    },
    rows,
  };
}
