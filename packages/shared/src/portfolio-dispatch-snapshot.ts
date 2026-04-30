// Portfolio dispatch snapshot.
//
// Plain English: as-of today, count dispatches, sum crew + equip
// headcount across all dispatches, break down by status, count
// distinct jobs + foremen, and surface YTD totals. Drives the
// right-now field-deployment overview.
//
// Pure derivation. No persisted records.

import type { Dispatch, DispatchStatus } from './dispatch';

export interface PortfolioDispatchSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalDispatches: number;
  ytdDispatches: number;
  totalCrewSeats: number;
  totalEquipmentSlots: number;
  byStatus: Partial<Record<DispatchStatus, number>>;
  distinctJobs: number;
  distinctForemen: number;
}

export interface PortfolioDispatchSnapshotInputs {
  dispatches: Dispatch[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioDispatchSnapshot(
  inputs: PortfolioDispatchSnapshotInputs,
): PortfolioDispatchSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byStatus = new Map<DispatchStatus, number>();
  const jobs = new Set<string>();
  const foremen = new Set<string>();

  let totalDispatches = 0;
  let ytdDispatches = 0;
  let totalCrewSeats = 0;
  let totalEquipmentSlots = 0;

  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    totalDispatches += 1;
    totalCrewSeats += d.crew?.length ?? 0;
    totalEquipmentSlots += d.equipment?.length ?? 0;
    byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1);
    jobs.add(d.jobId);
    if (d.foremanName) foremen.add(d.foremanName);
    if (Number(d.scheduledFor.slice(0, 4)) === logYear) ytdDispatches += 1;
  }

  const out: Partial<Record<DispatchStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    ytdLogYear: logYear,
    totalDispatches,
    ytdDispatches,
    totalCrewSeats,
    totalEquipmentSlots,
    byStatus: out,
    distinctJobs: jobs.size,
    distinctForemen: foremen.size,
  };
}
