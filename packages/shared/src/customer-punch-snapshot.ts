// Customer-anchored punch-list snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count punch items across all their jobs, status
// + severity mix, separate open vs closed, surface oldest open
// item age, distinct jobs. Drives the right-now per-customer
// punch-list overview.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { PunchItem, PunchItemSeverity, PunchItemStatus } from './punch-list';

export interface CustomerPunchSnapshotResult {
  asOf: string;
  customerName: string;
  totalItems: number;
  openCount: number;
  closedCount: number;
  byStatus: Partial<Record<PunchItemStatus, number>>;
  bySeverity: Partial<Record<PunchItemSeverity, number>>;
  openBySeverity: Partial<Record<PunchItemSeverity, number>>;
  oldestOpenAgeDays: number | null;
  distinctJobs: number;
}

export interface CustomerPunchSnapshotInputs {
  customerName: string;
  punchItems: PunchItem[];
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerPunchSnapshot(
  inputs: CustomerPunchSnapshotInputs,
): CustomerPunchSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const byStatus = new Map<PunchItemStatus, number>();
  const bySeverity = new Map<PunchItemSeverity, number>();
  const openBySeverity = new Map<PunchItemSeverity, number>();
  const jobs = new Set<string>();

  let totalItems = 0;
  let openCount = 0;
  let closedCount = 0;
  let oldestOpenAgeDays: number | null = null;

  for (const p of inputs.punchItems) {
    if (!customerJobs.has(p.jobId)) continue;
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
    jobs.add(p.jobId);
  }

  const sOut: Partial<Record<PunchItemStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;
  const svOut: Partial<Record<PunchItemSeverity, number>> = {};
  for (const [k, v] of bySeverity) svOut[k] = v;
  const osOut: Partial<Record<PunchItemSeverity, number>> = {};
  for (const [k, v] of openBySeverity) osOut[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalItems,
    openCount,
    closedCount,
    byStatus: sOut,
    bySeverity: svOut,
    openBySeverity: osOut,
    oldestOpenAgeDays,
    distinctJobs: jobs.size,
  };
}
