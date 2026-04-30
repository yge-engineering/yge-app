// Customer-anchored per-job PCO (Potential Change Order) detail
// snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job with PCO total, open count (anything not
// converted/withdrawn/rejected), open cost exposure cents, open
// schedule-day exposure, last PCO date. Sorted by open exposure
// cents desc.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Pco } from './pco';

export interface CustomerPcoDetailRow {
  jobId: string;
  total: number;
  open: number;
  approvedPendingCo: number;
  rejected: number;
  convertedToCo: number;
  openCostCents: number;
  openScheduleDays: number;
  lastPcoDate: string | null;
}

export interface CustomerPcoDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerPcoDetailRow[];
}

export interface CustomerPcoDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  pcos: Pco[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

const OPEN_STATUSES = new Set([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED_PENDING_CO',
]);

export function buildCustomerPcoDetailSnapshot(
  inputs: CustomerPcoDetailSnapshotInputs,
): CustomerPcoDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    total: number;
    open: number;
    approvedPendingCo: number;
    rejected: number;
    converted: number;
    openCostCents: number;
    openScheduleDays: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = {
        total: 0,
        open: 0,
        approvedPendingCo: 0,
        rejected: 0,
        converted: 0,
        openCostCents: 0,
        openScheduleDays: 0,
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const p of inputs.pcos) {
    if (!customerJobs.has(p.jobId)) continue;
    const onTimelineDate = p.submittedOn ?? p.noticedOn;
    if (onTimelineDate && onTimelineDate > asOf) continue;

    const a = getAcc(p.jobId);
    a.total += 1;
    if (OPEN_STATUSES.has(p.status)) {
      a.open += 1;
      a.openCostCents += p.costImpactCents;
      a.openScheduleDays += p.scheduleImpactDays;
      if (p.status === 'APPROVED_PENDING_CO') a.approvedPendingCo += 1;
    } else if (p.status === 'REJECTED') {
      a.rejected += 1;
    } else if (p.status === 'CONVERTED_TO_CO') {
      a.converted += 1;
    }
    if (onTimelineDate && (a.lastDate == null || onTimelineDate > a.lastDate)) {
      a.lastDate = onTimelineDate;
    }
  }

  const rows: CustomerPcoDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      total: a.total,
      open: a.open,
      approvedPendingCo: a.approvedPendingCo,
      rejected: a.rejected,
      convertedToCo: a.converted,
      openCostCents: a.openCostCents,
      openScheduleDays: a.openScheduleDays,
      lastPcoDate: a.lastDate,
    }))
    .sort((a, b) => b.openCostCents - a.openCostCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
