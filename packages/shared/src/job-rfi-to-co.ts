// Per-job RFI-to-CO conversion.
//
// Plain English: an RFI ("how do you want this curb detail done?")
// often costs YGE money to answer. When the engineer's answer is
// a scope change, that's a CO. ChangeOrder.originRfiId links the
// CO back to its triggering RFI. This module rolls that link up
// per job:
//   - how many RFIs led to a CO?
//   - what was the conversion rate?
//   - avg days from RFI sentAt to CO proposedAt
//   - total CO $ traceable to RFIs
//
// Drives the "RFIs are translating to dollar capture" view + the
// agency-rep accountability conversation when an RFI sat for 60
// days before the response triggered a CO.
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { Job } from './job';
import type { Rfi } from './rfi';

export interface JobRfiToCoRow {
  jobId: string;
  projectName: string;
  rfiCount: number;
  rfiToCoCount: number;
  conversionRate: number;
  /** Sum of |totalCostImpactCents| across COs that traced back
   *  to an RFI on this job. */
  totalRfiDrivenCoCents: number;
  /** Avg days from RFI sentAt to CO proposedAt across matched
   *  pairs. Null when no matched pairs. */
  avgDaysRfiToCo: number | null;
}

export interface JobRfiToCoRollup {
  jobsConsidered: number;
  totalRfis: number;
  totalRfisConverted: number;
  totalRfiDrivenCoCents: number;
}

export interface JobRfiToCoInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  rfis: Rfi[];
  changeOrders: ChangeOrder[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobRfiToCo(inputs: JobRfiToCoInputs): {
  rollup: JobRfiToCoRollup;
  rows: JobRfiToCoRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // RFI-id → RFI for fast lookup.
  const rfiById = new Map<string, Rfi>();
  for (const r of inputs.rfis) rfiById.set(r.id, r);

  // CO ↔ RFI pairings.
  type Pair = { rfi: Rfi; co: ChangeOrder };
  const pairsByJob = new Map<string, Pair[]>();
  const totalCoCentsByJob = new Map<string, number>();
  for (const co of inputs.changeOrders) {
    if (!co.originRfiId) continue;
    const rfi = rfiById.get(co.originRfiId);
    if (!rfi) continue;
    const list = pairsByJob.get(co.jobId) ?? [];
    list.push({ rfi, co });
    pairsByJob.set(co.jobId, list);
    totalCoCentsByJob.set(
      co.jobId,
      (totalCoCentsByJob.get(co.jobId) ?? 0) + Math.abs(co.totalCostImpactCents),
    );
  }

  // RFI count per job.
  const rfiCountByJob = new Map<string, number>();
  for (const r of inputs.rfis) {
    rfiCountByJob.set(r.jobId, (rfiCountByJob.get(r.jobId) ?? 0) + 1);
  }

  const rows: JobRfiToCoRow[] = [];
  let totalRfis = 0;
  let totalConverted = 0;
  let totalCents = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const rfiCount = rfiCountByJob.get(j.id) ?? 0;
    const pairs = pairsByJob.get(j.id) ?? [];
    const cents = totalCoCentsByJob.get(j.id) ?? 0;

    let totalDays = 0;
    let pairsWithDates = 0;
    for (const { rfi, co } of pairs) {
      if (!rfi.sentAt || !co.proposedAt) continue;
      const sent = parseDate(rfi.sentAt);
      const proposed = parseDate(co.proposedAt);
      if (!sent || !proposed) continue;
      totalDays += Math.max(0, daysBetween(sent, proposed));
      pairsWithDates += 1;
    }
    const avgDays = pairsWithDates === 0 ? null : round1(totalDays / pairsWithDates);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      rfiCount,
      rfiToCoCount: pairs.length,
      conversionRate: rfiCount === 0 ? 0 : round4(pairs.length / rfiCount),
      totalRfiDrivenCoCents: cents,
      avgDaysRfiToCo: avgDays,
    });
    totalRfis += rfiCount;
    totalConverted += pairs.length;
    totalCents += cents;
  }

  // Highest converted-CO cents first.
  rows.sort((a, b) => b.totalRfiDrivenCoCents - a.totalRfiDrivenCoCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalRfis,
      totalRfisConverted: totalConverted,
      totalRfiDrivenCoCents: totalCents,
    },
    rows,
  };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
