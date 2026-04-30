// Portfolio punch list snapshot (point-in-time).
//
// Plain English: as-of today, count punch items by status
// (OPEN / IN_PROGRESS / CLOSED / DISPUTED / WAIVED), severity
// mix on open items, distinct jobs, plus oldest open age in
// days.
//
// Pure derivation. No persisted records.

import type {
  PunchItem,
  PunchItemSeverity,
  PunchItemStatus,
} from './punch-list';

export interface PortfolioPunchSnapshotResult {
  totalItems: number;
  openCount: number;
  closedCount: number;
  byStatus: Partial<Record<PunchItemStatus, number>>;
  openBySeverity: Partial<Record<PunchItemSeverity, number>>;
  distinctJobs: number;
  oldestOpenAgeDays: number;
}

export interface PortfolioPunchSnapshotInputs {
  punchItems: PunchItem[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

const MS_PER_DAY = 86_400_000;

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / MS_PER_DAY,
  );
}

export function buildPortfolioPunchSnapshot(
  inputs: PortfolioPunchSnapshotInputs,
): PortfolioPunchSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const byStatus = new Map<PunchItemStatus, number>();
  const openBySeverity = new Map<PunchItemSeverity, number>();
  const jobs = new Set<string>();
  let openCount = 0;
  let closedCount = 0;
  let oldestOpenAgeDays = 0;

  for (const p of inputs.punchItems) {
    const status: PunchItemStatus = p.status ?? 'OPEN';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    jobs.add(p.jobId);
    const isOpen = status === 'OPEN' || status === 'IN_PROGRESS';
    const isClosed = status === 'CLOSED' || status === 'WAIVED';
    if (isOpen) {
      openCount += 1;
      const sev: PunchItemSeverity = p.severity ?? 'MINOR';
      openBySeverity.set(sev, (openBySeverity.get(sev) ?? 0) + 1);
      const age = Math.max(0, daysBetween(p.identifiedOn, asOf));
      if (age > oldestOpenAgeDays) oldestOpenAgeDays = age;
    }
    if (isClosed) closedCount += 1;
  }

  function statusRecord(m: Map<PunchItemStatus, number>): Partial<Record<PunchItemStatus, number>> {
    const out: Partial<Record<PunchItemStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function sevRecord(m: Map<PunchItemSeverity, number>): Partial<Record<PunchItemSeverity, number>> {
    const out: Partial<Record<PunchItemSeverity, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    totalItems: inputs.punchItems.length,
    openCount,
    closedCount,
    byStatus: statusRecord(byStatus),
    openBySeverity: sevRecord(openBySeverity),
    distinctJobs: jobs.size,
    oldestOpenAgeDays,
  };
}
