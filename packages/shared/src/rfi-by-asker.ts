// Per-asker RFI productivity.
//
// Plain English: every RFI on file has an askedByEmployeeId — the
// person on YGE who flagged the question to the agency. Some PMs
// catch design holes early (RFIs come back with cost impact —
// dollars we got onto a CO instead of swallowing). Some never
// raise an RFI at all. This rolls the log up by the asker so we
// can see who's working the design risk.
//
// Per row: askedByEmployeeId, rfisAsked, answeredCount,
// costImpactCount, scheduleImpactCount, avgResponseDays (over
// answered RFIs that have both sentAt + answeredAt),
// distinctJobs.
//
// Sort by rfisAsked desc.
//
// Different from rfi-board (active list), rfi-monthly-volume (by
// month), job-rfi-impact-summary (per-job impact). This is the
// asker view.
//
// Pure derivation. No persisted records.

import type { Rfi } from './rfi';

export interface RfiByAskerRow {
  askedByEmployeeId: string;
  rfisAsked: number;
  answeredCount: number;
  costImpactCount: number;
  scheduleImpactCount: number;
  avgResponseDays: number;
  distinctJobs: number;
}

export interface RfiByAskerRollup {
  askersConsidered: number;
  totalRfis: number;
  unattributedRfis: number;
}

export interface RfiByAskerInputs {
  rfis: Rfi[];
  /** Optional yyyy-mm-dd window applied to sentAt (or createdAt slice
   *  when sentAt is not yet set). */
  fromDate?: string;
  toDate?: string;
}

export function buildRfiByAsker(
  inputs: RfiByAskerInputs,
): {
  rollup: RfiByAskerRollup;
  rows: RfiByAskerRow[];
} {
  type Acc = {
    asker: string;
    asked: number;
    answered: number;
    cost: number;
    schedule: number;
    responseDaysSum: number;
    responseDaysCount: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  let unattributed = 0;
  let total = 0;

  for (const r of inputs.rfis) {
    const ref = r.sentAt ?? r.createdAt.slice(0, 10);
    if (inputs.fromDate && ref < inputs.fromDate) continue;
    if (inputs.toDate && ref > inputs.toDate) continue;
    total += 1;
    const asker = (r.askedByEmployeeId ?? '').trim();
    if (!asker) {
      unattributed += 1;
      continue;
    }
    const acc = accs.get(asker) ?? {
      asker,
      asked: 0,
      answered: 0,
      cost: 0,
      schedule: 0,
      responseDaysSum: 0,
      responseDaysCount: 0,
      jobs: new Set<string>(),
    };
    acc.asked += 1;
    acc.jobs.add(r.jobId);
    if (r.status === 'ANSWERED' || r.status === 'CLOSED') {
      acc.answered += 1;
      if (r.costImpact) acc.cost += 1;
      if (r.scheduleImpact) acc.schedule += 1;
      if (r.sentAt && r.answeredAt) {
        const days = daysBetween(r.sentAt, r.answeredAt);
        acc.responseDaysSum += days;
        acc.responseDaysCount += 1;
      }
    }
    accs.set(asker, acc);
  }

  const rows: RfiByAskerRow[] = [];
  for (const acc of accs.values()) {
    const avg = acc.responseDaysCount === 0
      ? 0
      : Math.round((acc.responseDaysSum / acc.responseDaysCount) * 100) / 100;
    rows.push({
      askedByEmployeeId: acc.asker,
      rfisAsked: acc.asked,
      answeredCount: acc.answered,
      costImpactCount: acc.cost,
      scheduleImpactCount: acc.schedule,
      avgResponseDays: avg,
      distinctJobs: acc.jobs.size,
    });
  }

  rows.sort((a, b) => b.rfisAsked - a.rfisAsked);

  return {
    rollup: {
      askersConsidered: rows.length,
      totalRfis: total,
      unattributedRfis: unattributed,
    },
    rows,
  };
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
