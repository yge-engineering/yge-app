// Per-job RFI-to-CO conversion timing.
//
// Plain English: when a CO carries originRfiId pointing at an
// RFI, that's the paper trail RFI → answer → CO. The TIME
// between the RFI sentAt and the CO proposedAt is how long
// the office sat on the answer before booking the cost. Long
// gaps mean lost claim leverage (memory fades).
//
// Per AWARDED job: list of RFI→CO chains with each chain's
// rfiSentAt, coProposedAt, gapDays, plus median gap across the
// job. Different from job-rfi-to-co (conversion rate) and
// pco-vs-co-analysis (PCO conversion). This is the timing view.
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { Job } from './job';
import type { Rfi } from './rfi';

export interface RfiCoChain {
  rfiId: string;
  rfiNumber: string;
  rfiSentAt: string | null;
  coId: string;
  coNumber: string;
  coProposedAt: string | null;
  /** rfiSentAt → coProposedAt in days. Null if either date missing. */
  gapDays: number | null;
}

export interface JobRfiToCoTimingRow {
  jobId: string;
  projectName: string;
  chainCount: number;
  medianGapDays: number | null;
  longestGapDays: number | null;
  chains: RfiCoChain[];
}

export interface JobRfiToCoTimingRollup {
  jobsConsidered: number;
  totalChains: number;
  blendedMedianGapDays: number | null;
}

export interface JobRfiToCoTimingInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  rfis: Rfi[];
  changeOrders: ChangeOrder[];
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
}

export function buildJobRfiToCoTiming(
  inputs: JobRfiToCoTimingInputs,
): {
  rollup: JobRfiToCoTimingRollup;
  rows: JobRfiToCoTimingRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // Index RFIs by id.
  const rfiById = new Map<string, Rfi>();
  for (const r of inputs.rfis) rfiById.set(r.id, r);

  // Bucket COs (with originRfiId) by jobId.
  const cosByJob = new Map<string, ChangeOrder[]>();
  for (const co of inputs.changeOrders) {
    if (!co.originRfiId) continue;
    const list = cosByJob.get(co.jobId) ?? [];
    list.push(co);
    cosByJob.set(co.jobId, list);
  }

  let totalChains = 0;
  const allGaps: number[] = [];

  const rows: JobRfiToCoTimingRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const cos = cosByJob.get(j.id) ?? [];
    const chains: RfiCoChain[] = [];
    const gaps: number[] = [];
    for (const co of cos) {
      const rfi = co.originRfiId ? rfiById.get(co.originRfiId) : undefined;
      if (!rfi) continue;
      const rfiSent = rfi.sentAt ?? null;
      const coProposed = co.proposedAt ?? null;
      let gap: number | null = null;
      if (rfiSent && coProposed) {
        gap = daysBetween(rfiSent, coProposed);
        if (gap >= 0) {
          gaps.push(gap);
          allGaps.push(gap);
        } else {
          gap = null;
        }
      }
      chains.push({
        rfiId: rfi.id,
        rfiNumber: rfi.rfiNumber,
        rfiSentAt: rfiSent,
        coId: co.id,
        coNumber: co.changeOrderNumber,
        coProposedAt: coProposed,
        gapDays: gap,
      });
    }

    chains.sort((a, b) => (b.gapDays ?? -1) - (a.gapDays ?? -1));

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      chainCount: chains.length,
      medianGapDays: computeMedian(gaps),
      longestGapDays: gaps.length === 0
        ? null
        : Math.max(...gaps),
      chains,
    });

    totalChains += chains.length;
  }

  rows.sort((a, b) => {
    if (a.chainCount !== b.chainCount) return b.chainCount - a.chainCount;
    return (b.longestGapDays ?? -1) - (a.longestGapDays ?? -1);
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalChains,
      blendedMedianGapDays: computeMedian(allGaps),
    },
    rows,
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return Math.round(((a + b) / 2) * 10) / 10;
}
