// Job-anchored per-origin PCO detail snapshot.
//
// Plain English: for one job, return one row per PCO origin
// (owner-directed, design-change, unforeseen, RFI-response, spec-
// conflict, weather-delay, other): total, open, approved-pending-
// CO, rejected, converted-to-CO, open cost-cents exposure, open
// schedule-day exposure, last PCO date. Sorted by open exposure
// desc.
//
// Pure derivation. No persisted records.

import type { Pco } from './pco';

export interface JobPcoDetailRow {
  origin: string;
  total: number;
  open: number;
  approvedPendingCo: number;
  rejected: number;
  convertedToCo: number;
  openCostCents: number;
  openScheduleDays: number;
  lastPcoDate: string | null;
}

export interface JobPcoDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobPcoDetailRow[];
}

export interface JobPcoDetailSnapshotInputs {
  jobId: string;
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

const OPEN_STATUSES = new Set([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED_PENDING_CO',
]);

export function buildJobPcoDetailSnapshot(
  inputs: JobPcoDetailSnapshotInputs,
): JobPcoDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

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
  const byOrigin = new Map<string, Acc>();
  function getAcc(origin: string): Acc {
    let a = byOrigin.get(origin);
    if (!a) {
      a = { total: 0, open: 0, approvedPendingCo: 0, rejected: 0, converted: 0, openCostCents: 0, openScheduleDays: 0, lastDate: null };
      byOrigin.set(origin, a);
    }
    return a;
  }

  for (const p of inputs.pcos) {
    if (p.jobId !== inputs.jobId) continue;
    const onTimelineDate = p.submittedOn ?? p.noticedOn;
    if (onTimelineDate && onTimelineDate > asOf) continue;
    const a = getAcc(p.origin);
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

  const rows: JobPcoDetailRow[] = [...byOrigin.entries()]
    .map(([origin, a]) => ({
      origin,
      total: a.total,
      open: a.open,
      approvedPendingCo: a.approvedPendingCo,
      rejected: a.rejected,
      convertedToCo: a.converted,
      openCostCents: a.openCostCents,
      openScheduleDays: a.openScheduleDays,
      lastPcoDate: a.lastDate,
    }))
    .sort((a, b) => b.openCostCents - a.openCostCents || a.origin.localeCompare(b.origin));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
