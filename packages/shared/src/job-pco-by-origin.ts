// Per (job, PCO origin) rollup.
//
// Plain English: per job, break PCOs out by origin
// (OWNER_DIRECTED / DESIGN_CHANGE / UNFORESEEN_CONDITION /
// RFI_RESPONSE / SPEC_CONFLICT / WEATHER_DELAY / OTHER). Useful
// for "Sulphur Springs is heavy on UNFORESEEN_CONDITION,
// document soils early next pursuit" insight.
//
// Per row: jobId, origin, total, openCount, convertedCount,
// totalCostImpactCents.
//
// Sort: jobId asc, totalCostImpactCents desc within job.
//
// Different from job-pco-summary (per job rollup, no origin
// axis), pco-origin-breakdown (portfolio per origin).
//
// Pure derivation. No persisted records.

import type { Pco, PcoOrigin, PcoStatus } from './pco';

const OPEN: ReadonlyArray<PcoStatus> = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED_PENDING_CO',
];

export interface JobPcoByOriginRow {
  jobId: string;
  origin: PcoOrigin;
  total: number;
  openCount: number;
  convertedCount: number;
  totalCostImpactCents: number;
}

export interface JobPcoByOriginRollup {
  jobsConsidered: number;
  originsConsidered: number;
  totalPcos: number;
}

export interface JobPcoByOriginInputs {
  pcos: Pco[];
  /** Optional yyyy-mm-dd window applied to noticedOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobPcoByOrigin(
  inputs: JobPcoByOriginInputs,
): {
  rollup: JobPcoByOriginRollup;
  rows: JobPcoByOriginRow[];
} {
  type Acc = {
    jobId: string;
    origin: PcoOrigin;
    total: number;
    open: number;
    converted: number;
    cost: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const originSet = new Set<PcoOrigin>();
  let totalPcos = 0;

  for (const p of inputs.pcos) {
    if (inputs.fromDate && p.noticedOn < inputs.fromDate) continue;
    if (inputs.toDate && p.noticedOn > inputs.toDate) continue;
    const key = `${p.jobId}|${p.origin}`;
    const acc = accs.get(key) ?? {
      jobId: p.jobId,
      origin: p.origin,
      total: 0,
      open: 0,
      converted: 0,
      cost: 0,
    };
    acc.total += 1;
    if (OPEN.includes(p.status)) {
      acc.open += 1;
      if (p.costImpactCents > 0) acc.cost += p.costImpactCents;
    }
    if (p.status === 'CONVERTED_TO_CO') acc.converted += 1;
    accs.set(key, acc);
    jobSet.add(p.jobId);
    originSet.add(p.origin);
    totalPcos += 1;
  }

  const rows: JobPcoByOriginRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      origin: acc.origin,
      total: acc.total,
      openCount: acc.open,
      convertedCount: acc.converted,
      totalCostImpactCents: acc.cost,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return b.totalCostImpactCents - a.totalCostImpactCents;
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      originsConsidered: originSet.size,
      totalPcos,
    },
    rows,
  };
}
