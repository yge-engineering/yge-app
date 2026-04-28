// Per-job DR scope-completeness audit.
//
// Plain English: a daily report with no scopeCompleted text and
// no nextDayPlan is a near-useless report. Reading that pile a
// year later when an agency disputes a claim, you can't reconstruct
// what happened. This module flags AWARDED jobs whose foremen are
// submitting "shell" DRs.
//
// Per AWARDED job:
//   - drCount: total submitted DRs
//   - withScope: count with scopeCompleted populated (>0 chars after trim)
//   - withPlan: count with nextDayPlan populated
//   - withIssues: count with issues populated (most reports won't —
//     this is informational, not a quality gate)
//   - withVisitors: count with visitors populated
//   - completenessRate: (withScope AND withPlan) / drCount
//   - flag: STRONG / OK / THIN / POOR
//
// Different from dr-photo-coverage (photos), dr-timeliness (lateness),
// daily-report-compliance (CA labor law). This is the prose-quality view.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Job } from './job';

export type DrScopeCompletenessFlag =
  | 'STRONG'   // >= 90% of DRs have both scope + plan
  | 'OK'       // 70-90%
  | 'THIN'     // 40-70%
  | 'POOR';    // < 40%

export interface JobDrScopeCompletenessRow {
  jobId: string;
  projectName: string;
  drCount: number;
  withScope: number;
  withPlan: number;
  withIssues: number;
  withVisitors: number;
  /** Fraction (0..1) of DRs with both scope + plan populated. */
  completenessRate: number;
  flag: DrScopeCompletenessFlag;
}

export interface JobDrScopeCompletenessRollup {
  jobsConsidered: number;
  totalDrs: number;
  strong: number;
  ok: number;
  thin: number;
  poor: number;
}

export interface JobDrScopeCompletenessInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  reports: DailyReport[];
  /** Optional yyyy-mm-dd window applied to DR.date. */
  fromDate?: string;
  toDate?: string;
  /** Default false — only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobDrScopeCompleteness(
  inputs: JobDrScopeCompletenessInputs,
): {
  rollup: JobDrScopeCompletenessRollup;
  rows: JobDrScopeCompletenessRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // Window-filter once.
  const reports = inputs.reports.filter((r) => {
    if (!r.submitted) return false;
    if (inputs.fromDate && r.date < inputs.fromDate) return false;
    if (inputs.toDate && r.date > inputs.toDate) return false;
    return true;
  });

  // Bucket by jobId.
  const drsByJob = new Map<string, DailyReport[]>();
  for (const r of reports) {
    const list = drsByJob.get(r.jobId) ?? [];
    list.push(r);
    drsByJob.set(r.jobId, list);
  }

  let strong = 0;
  let ok = 0;
  let thin = 0;
  let poor = 0;
  let totalDrs = 0;

  const rows: JobDrScopeCompletenessRow[] = [];

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const drs = drsByJob.get(j.id) ?? [];
    let withScope = 0;
    let withPlan = 0;
    let withIssues = 0;
    let withVisitors = 0;
    let bothScopeAndPlan = 0;

    for (const dr of drs) {
      const hasScope = nonEmpty(dr.scopeCompleted);
      const hasPlan = nonEmpty(dr.nextDayPlan);
      if (hasScope) withScope += 1;
      if (hasPlan) withPlan += 1;
      if (nonEmpty(dr.issues)) withIssues += 1;
      if (nonEmpty(dr.visitors)) withVisitors += 1;
      if (hasScope && hasPlan) bothScopeAndPlan += 1;
    }

    const rate = drs.length === 0 ? 0 : bothScopeAndPlan / drs.length;
    const flag = scoreFlag(rate, drs.length);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      drCount: drs.length,
      withScope,
      withPlan,
      withIssues,
      withVisitors,
      completenessRate: round4(rate),
      flag,
    });

    totalDrs += drs.length;
    if (flag === 'STRONG') strong += 1;
    else if (flag === 'OK') ok += 1;
    else if (flag === 'THIN') thin += 1;
    else poor += 1;
  }

  // Sort: worst-first (poor → thin → ok → strong); within tier by drCount desc.
  const tier: Record<DrScopeCompletenessFlag, number> = { POOR: 0, THIN: 1, OK: 2, STRONG: 3 };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tier[a.flag] - tier[b.flag];
    return b.drCount - a.drCount;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalDrs,
      strong,
      ok,
      thin,
      poor,
    },
    rows,
  };
}

function nonEmpty(s: string | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

function scoreFlag(rate: number, drCount: number): DrScopeCompletenessFlag {
  // Empty job — call it POOR so it surfaces (foremen not filing DRs at
  // all is the worst possible signal).
  if (drCount === 0) return 'POOR';
  if (rate >= 0.9) return 'STRONG';
  if (rate >= 0.7) return 'OK';
  if (rate >= 0.4) return 'THIN';
  return 'POOR';
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
