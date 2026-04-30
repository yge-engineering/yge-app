// Job-anchored RFI snapshot (point-in-time per single job).
//
// Plain English: for one job, as-of today, count RFIs by
// status + priority, count open and overdue, count cost +
// schedule impact, and surface oldest open RFI age in days.
// Drives the right-now per-job RFI overview on the job-detail
// page.
//
// Different from portfolio-rfi-snapshot (across all jobs) and
// per-job RFI list views (which show records, not derivations).
//
// Pure derivation. No persisted records.

import type { Rfi, RfiPriority, RfiStatus } from './rfi';

export interface JobRfiSnapshotResult {
  asOf: string;
  jobId: string;
  totalRfis: number;
  byStatus: Partial<Record<RfiStatus, number>>;
  byPriority: Partial<Record<RfiPriority, number>>;
  openCount: number;
  overdueCount: number;
  costImpactCount: number;
  scheduleImpactCount: number;
  oldestOpenAgeDays: number | null;
}

export interface JobRfiSnapshotInputs {
  jobId: string;
  rfis: Rfi[];
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

function daysBetween(fromIso: string, toIso: string): number {
  const f = Date.parse(fromIso);
  const t = Date.parse(toIso);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.floor((t - f) / (1000 * 60 * 60 * 24));
}

export function buildJobRfiSnapshot(
  inputs: JobRfiSnapshotInputs,
): JobRfiSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byStatus = new Map<RfiStatus, number>();
  const byPriority = new Map<RfiPriority, number>();
  let totalRfis = 0;
  let openCount = 0;
  let overdueCount = 0;
  let costImpactCount = 0;
  let scheduleImpactCount = 0;
  let oldestOpenAgeDays: number | null = null;

  for (const r of inputs.rfis) {
    if (r.jobId !== inputs.jobId) continue;
    totalRfis += 1;
    const status: RfiStatus = r.status ?? 'DRAFT';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    const pri: RfiPriority = r.priority ?? 'MEDIUM';
    byPriority.set(pri, (byPriority.get(pri) ?? 0) + 1);
    const isOpen = status === 'DRAFT' || status === 'SENT';
    if (isOpen) {
      openCount += 1;
      if (r.responseDueAt && r.responseDueAt < asOf && !r.answeredAt) {
        overdueCount += 1;
      }
      const opened = r.sentAt ?? r.createdAt;
      if (opened) {
        const age = daysBetween(opened.slice(0, 10), asOf);
        if (oldestOpenAgeDays == null || age > oldestOpenAgeDays) oldestOpenAgeDays = age;
      }
    }
    if (r.costImpact) costImpactCount += 1;
    if (r.scheduleImpact) scheduleImpactCount += 1;
  }

  const sOut: Partial<Record<RfiStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;
  const pOut: Partial<Record<RfiPriority, number>> = {};
  for (const [k, v] of byPriority) pOut[k] = v;

  return {
    asOf,
    jobId: inputs.jobId,
    totalRfis,
    byStatus: sOut,
    byPriority: pOut,
    openCount,
    overdueCount,
    costImpactCount,
    scheduleImpactCount,
    oldestOpenAgeDays,
  };
}
