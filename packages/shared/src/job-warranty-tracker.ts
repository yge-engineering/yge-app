// Job warranty period tracker.
//
// Plain English: most CA public works contracts include a warranty
// period — typically 1 year from substantial completion — during
// which YGE has to cover defects without charge. After the period
// closes, the agency releases retention and the warranty obligation
// ends.
//
// This walks AWARDED jobs with a substantial-completion date in the
// past and surfaces:
//   - days into the warranty
//   - days remaining (or null if expired)
//   - tier: ACTIVE_NEW / ACTIVE_MID / ACTIVE_LATE / EXPIRED
//   - total contract $ in each tier — the warranty exposure
//
// Pure derivation. No persisted records. Caller supplies the
// substantialCompletionDateByJobId map (Phase 2 will add that field
// to Job directly).

import type { Job } from './job';

export type WarrantyFlag =
  | 'ACTIVE_NEW'    // 0-90 days in (early defects most likely)
  | 'ACTIVE_MID'    // 91-275 days in
  | 'ACTIVE_LATE'   // 276 days to warranty end
  | 'EXPIRED';      // past warranty end date

export interface WarrantyRow {
  jobId: string;
  projectName: string;
  substantialCompletionDate: string;
  warrantyEndDate: string;
  daysInWarranty: number;
  daysToEnd: number | null;
  contractValueCents: number;
  flag: WarrantyFlag;
}

export interface WarrantyRollup {
  jobsConsidered: number;
  activeNew: number;
  activeMid: number;
  activeLate: number;
  expired: number;
  /** Sum of contractValueCents across non-EXPIRED rows. */
  activeWarrantyExposureCents: number;
}

export interface WarrantyInputs {
  asOf?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  /** Map<jobId, substantialCompletionDate yyyy-mm-dd>. */
  substantialCompletionByJobId: Map<string, string>;
  /** Map<jobId, contract value cents>. Drives the exposure number. */
  contractValueByJobId?: Map<string, number>;
  /** Warranty period in days. CA public works default is 365. */
  warrantyDays?: number;
  /** When false (default), skip non-AWARDED jobs. */
  includeAllStatuses?: boolean;
}

export function buildJobWarrantyTracker(inputs: WarrantyInputs): {
  rollup: WarrantyRollup;
  rows: WarrantyRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const includeAll = inputs.includeAllStatuses === true;
  const warrantyDays = inputs.warrantyDays ?? 365;

  const rows: WarrantyRow[] = [];
  const counts = { activeNew: 0, activeMid: 0, activeLate: 0, expired: 0 };
  let activeExposure = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const subDate = inputs.substantialCompletionByJobId.get(j.id);
    if (!subDate) continue;
    const subParsed = parseDate(subDate);
    if (!subParsed) continue;

    const endDate = new Date(subParsed.getTime() + warrantyDays * 24 * 60 * 60 * 1000);
    const daysIn = daysBetween(subParsed, refNow);
    const daysToEnd = daysBetween(refNow, endDate);

    let flag: WarrantyFlag;
    if (daysToEnd <= 0) flag = 'EXPIRED';
    else if (daysIn <= 90) flag = 'ACTIVE_NEW';
    else if (daysIn <= 275) flag = 'ACTIVE_MID';
    else flag = 'ACTIVE_LATE';

    const contractValue = inputs.contractValueByJobId?.get(j.id) ?? 0;
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      substantialCompletionDate: subDate,
      warrantyEndDate: isoDate(endDate),
      daysInWarranty: Math.max(0, daysIn),
      daysToEnd: flag === 'EXPIRED' ? null : daysToEnd,
      contractValueCents: contractValue,
      flag,
    });

    if (flag === 'ACTIVE_NEW') counts.activeNew += 1;
    else if (flag === 'ACTIVE_MID') counts.activeMid += 1;
    else if (flag === 'ACTIVE_LATE') counts.activeLate += 1;
    else counts.expired += 1;
    if (flag !== 'EXPIRED') activeExposure += contractValue;
  }

  // ACTIVE_LATE first (closest to release / most urgent to chase
  // any open warranty claims), then MID, then NEW, EXPIRED last.
  const tierRank: Record<WarrantyFlag, number> = {
    ACTIVE_LATE: 0,
    ACTIVE_MID: 1,
    ACTIVE_NEW: 2,
    EXPIRED: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    if (a.daysToEnd === null) return 1;
    if (b.daysToEnd === null) return -1;
    return a.daysToEnd - b.daysToEnd;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      activeNew: counts.activeNew,
      activeMid: counts.activeMid,
      activeLate: counts.activeLate,
      expired: counts.expired,
      activeWarrantyExposureCents: activeExposure,
    },
    rows,
  };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
