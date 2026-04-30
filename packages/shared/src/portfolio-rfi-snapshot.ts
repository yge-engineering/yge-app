// Portfolio RFI snapshot (point-in-time).
//
// Plain English: as-of today, count RFIs by status (DRAFT,
// SENT, ANSWERED, CLOSED) plus open-and-overdue + cost/
// schedule impact + distinct jobs.
//
// Pure derivation. No persisted records.

import type { Rfi, RfiPriority, RfiStatus } from './rfi';

export interface PortfolioRfiSnapshotResult {
  totalRfis: number;
  byStatus: Partial<Record<RfiStatus, number>>;
  byPriority: Partial<Record<RfiPriority, number>>;
  openCount: number;
  overdueCount: number;
  costImpactCount: number;
  scheduleImpactCount: number;
  distinctJobs: number;
}

export interface PortfolioRfiSnapshotInputs {
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

export function buildPortfolioRfiSnapshot(
  inputs: PortfolioRfiSnapshotInputs,
): PortfolioRfiSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byStatus = new Map<RfiStatus, number>();
  const byPriority = new Map<RfiPriority, number>();
  let openCount = 0;
  let overdueCount = 0;
  let costImpactCount = 0;
  let scheduleImpactCount = 0;
  const jobs = new Set<string>();

  for (const r of inputs.rfis) {
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
    }
    if (r.costImpact) costImpactCount += 1;
    if (r.scheduleImpact) scheduleImpactCount += 1;
    jobs.add(r.jobId);
  }

  function statusRecord(m: Map<RfiStatus, number>): Partial<Record<RfiStatus, number>> {
    const out: Partial<Record<RfiStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function priRecord(m: Map<RfiPriority, number>): Partial<Record<RfiPriority, number>> {
    const out: Partial<Record<RfiPriority, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    totalRfis: inputs.rfis.length,
    byStatus: statusRecord(byStatus),
    byPriority: priRecord(byPriority),
    openCount,
    overdueCount,
    costImpactCount,
    scheduleImpactCount,
    distinctJobs: jobs.size,
  };
}
