// Job-anchored punch-list snapshot.
//
// Plain English: for one job, as-of today, count punch items
// by status + severity, separate open vs closed, surface
// oldest-open-item age in days, count distinct locations.
// Drives the right-now per-job punch-list overview.
//
// Pure derivation. No persisted records.

import type { PunchItem, PunchItemSeverity, PunchItemStatus } from './punch-list';

export interface JobPunchSnapshotResult {
  asOf: string;
  jobId: string;
  totalItems: number;
  openCount: number;
  closedCount: number;
  byStatus: Partial<Record<PunchItemStatus, number>>;
  bySeverity: Partial<Record<PunchItemSeverity, number>>;
  openBySeverity: Partial<Record<PunchItemSeverity, number>>;
  oldestOpenAgeDays: number | null;
  distinctLocations: number;
}

export interface JobPunchSnapshotInputs {
  jobId: string;
  punchItems: PunchItem[];
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

export function buildJobPunchSnapshot(
  inputs: JobPunchSnapshotInputs,
): JobPunchSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byStatus = new Map<PunchItemStatus, number>();
  const bySeverity = new Map<PunchItemSeverity, number>();
  const openBySeverity = new Map<PunchItemSeverity, number>();
  const locations = new Set<string>();

  let totalItems = 0;
  let openCount = 0;
  let closedCount = 0;
  let oldestOpenAgeDays: number | null = null;

  for (const p of inputs.punchItems) {
    if (p.jobId !== inputs.jobId) continue;
    totalItems += 1;
    byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
    bySeverity.set(p.severity, (bySeverity.get(p.severity) ?? 0) + 1);
    const isOpen = p.status === 'OPEN' || p.status === 'IN_PROGRESS' || p.status === 'DISPUTED';
    if (isOpen) {
      openCount += 1;
      openBySeverity.set(p.severity, (openBySeverity.get(p.severity) ?? 0) + 1);
      if (p.identifiedOn) {
        const age = daysBetween(p.identifiedOn, asOf);
        if (oldestOpenAgeDays == null || age > oldestOpenAgeDays) oldestOpenAgeDays = age;
      }
    } else {
      closedCount += 1;
    }
    if (p.location) locations.add(p.location.trim().toLowerCase());
  }

  const sOut: Partial<Record<PunchItemStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;
  const svOut: Partial<Record<PunchItemSeverity, number>> = {};
  for (const [k, v] of bySeverity) svOut[k] = v;
  const osOut: Partial<Record<PunchItemSeverity, number>> = {};
  for (const [k, v] of openBySeverity) osOut[k] = v;

  return {
    asOf,
    jobId: inputs.jobId,
    totalItems,
    openCount,
    closedCount,
    byStatus: sOut,
    bySeverity: svOut,
    openBySeverity: osOut,
    oldestOpenAgeDays,
    distinctLocations: locations.size,
  };
}
