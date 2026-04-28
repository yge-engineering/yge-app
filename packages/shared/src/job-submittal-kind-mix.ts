// Per-job submittal kind mix.
//
// Plain English: for each AWARDED job, break the submittal log
// down by kind — SHOP_DRAWING / PRODUCT_DATA / SAMPLE /
// CERTIFICATE / METHOD_STATEMENT / MIX_DESIGN /
// OPERATIONS_MANUAL / WARRANTY / OTHER. Per kind: count + open
// count (DRAFT or SUBMITTED). Useful for spec-section coverage
// audits and predicting where the next round of resubmittals
// will come from (mix designs and shop drawings tend to bounce).
//
// Different from job-submittal-pipeline (status counts) and
// submittal-board (portfolio list). This is the per-job
// composition view.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Submittal, SubmittalKind } from './submittal';

export interface SubmittalKindEntry {
  kind: SubmittalKind;
  total: number;
  open: number;
  share: number;
}

export interface JobSubmittalKindMixRow {
  jobId: string;
  projectName: string;
  totalSubmittals: number;
  totalOpen: number;
  byKind: SubmittalKindEntry[];
}

export interface JobSubmittalKindMixRollup {
  jobsConsidered: number;
  totalSubmittals: number;
  totalOpen: number;
  /** Per-kind portfolio totals. */
  portfolioByKind: Partial<Record<SubmittalKind, number>>;
}

export interface JobSubmittalKindMixInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  submittals: Submittal[];
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
}

export function buildJobSubmittalKindMix(
  inputs: JobSubmittalKindMixInputs,
): {
  rollup: JobSubmittalKindMixRollup;
  rows: JobSubmittalKindMixRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const byJob = new Map<string, Submittal[]>();
  for (const s of inputs.submittals) {
    const list = byJob.get(s.jobId) ?? [];
    list.push(s);
    byJob.set(s.jobId, list);
  }

  let totalAll = 0;
  let totalOpenAll = 0;
  const portfolio = new Map<SubmittalKind, number>();

  const rows: JobSubmittalKindMixRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const subs = byJob.get(j.id) ?? [];
    const counts = new Map<SubmittalKind, { total: number; open: number }>();
    for (const s of subs) {
      const cur = counts.get(s.kind) ?? { total: 0, open: 0 };
      cur.total += 1;
      if (s.status === 'DRAFT' || s.status === 'SUBMITTED' || s.status === 'REVISE_RESUBMIT') {
        cur.open += 1;
      }
      counts.set(s.kind, cur);
      portfolio.set(s.kind, (portfolio.get(s.kind) ?? 0) + 1);
    }
    const total = subs.length;
    const totalOpen = Array.from(counts.values()).reduce((acc, c) => acc + c.open, 0);
    const byKind: SubmittalKindEntry[] = Array.from(counts.entries())
      .map(([kind, c]) => ({
        kind,
        total: c.total,
        open: c.open,
        share: total === 0 ? 0 : Math.round((c.total / total) * 10_000) / 10_000,
      }))
      .sort((a, b) => b.total - a.total);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      totalSubmittals: total,
      totalOpen,
      byKind,
    });

    totalAll += total;
    totalOpenAll += totalOpen;
  }

  rows.sort((a, b) => b.totalSubmittals - a.totalSubmittals);

  const portfolioObj: Partial<Record<SubmittalKind, number>> = {};
  for (const [k, v] of portfolio.entries()) portfolioObj[k] = v;

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalSubmittals: totalAll,
      totalOpen: totalOpenAll,
      portfolioByKind: portfolioObj,
    },
    rows,
  };
}
