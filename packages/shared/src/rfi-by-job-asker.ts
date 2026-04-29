// Per (job, asker) RFI rollup.
//
// Plain English: bucket RFIs by (jobId, askedByEmployeeId) —
// who's raising RFIs on which job. Useful for the "Joe is raising
// most RFIs on Sulphur Springs — make sure he's looped in to the
// CO conversations" cross-reference.
//
// Per row: jobId, askedByEmployeeId, rfisAsked, answered,
// costImpactCount, scheduleImpactCount.
//
// Sort: jobId asc, rfisAsked desc within job.
//
// Different from job-rfi-impact-summary (per-job rollup, no
// asker axis), rfi-by-asker (per-asker lifetime).
//
// Pure derivation. No persisted records.

import type { Rfi } from './rfi';

export interface RfiByJobAskerRow {
  jobId: string;
  askedByEmployeeId: string;
  rfisAsked: number;
  answered: number;
  costImpactCount: number;
  scheduleImpactCount: number;
}

export interface RfiByJobAskerRollup {
  jobsConsidered: number;
  askersConsidered: number;
  totalRfis: number;
  unattributed: number;
}

export interface RfiByJobAskerInputs {
  rfis: Rfi[];
  /** Optional yyyy-mm-dd window applied to sentAt. */
  fromDate?: string;
  toDate?: string;
}

export function buildRfiByJobAsker(
  inputs: RfiByJobAskerInputs,
): {
  rollup: RfiByJobAskerRollup;
  rows: RfiByJobAskerRow[];
} {
  type Acc = {
    jobId: string;
    asker: string;
    asked: number;
    answered: number;
    cost: number;
    schedule: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const askerSet = new Set<string>();
  let totalRfis = 0;
  let unattributed = 0;

  for (const r of inputs.rfis) {
    const ref = r.sentAt ?? r.createdAt.slice(0, 10);
    if (inputs.fromDate && ref < inputs.fromDate) continue;
    if (inputs.toDate && ref > inputs.toDate) continue;
    totalRfis += 1;
    const asker = (r.askedByEmployeeId ?? '').trim();
    if (!asker) {
      unattributed += 1;
      continue;
    }
    const key = `${r.jobId}|${asker}`;
    const acc = accs.get(key) ?? {
      jobId: r.jobId,
      asker,
      asked: 0,
      answered: 0,
      cost: 0,
      schedule: 0,
    };
    acc.asked += 1;
    if (r.status === 'ANSWERED' || r.status === 'CLOSED') acc.answered += 1;
    if (r.costImpact) acc.cost += 1;
    if (r.scheduleImpact) acc.schedule += 1;
    accs.set(key, acc);
    jobSet.add(r.jobId);
    askerSet.add(asker);
  }

  const rows: RfiByJobAskerRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      askedByEmployeeId: acc.asker,
      rfisAsked: acc.asked,
      answered: acc.answered,
      costImpactCount: acc.cost,
      scheduleImpactCount: acc.schedule,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return b.rfisAsked - a.rfisAsked;
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      askersConsidered: askerSet.size,
      totalRfis,
      unattributed,
    },
    rows,
  };
}
