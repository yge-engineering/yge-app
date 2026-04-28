// Per-job foreman assignment continuity.
//
// Plain English: which foreman is the primary on each AWARDED
// job? On a healthy job, one foreman files most DRs and the
// crew has stable leadership. On a job in trouble, a parade of
// foremen rotate through. This module groups submitted DRs by
// (jobId, foremanId) and surfaces:
//   - primary foreman + share of DRs
//   - count of distinct foremen on the job
//   - secondary foremen and their share (the rotation tail)
//
// Different from foreman-scorecard (per-foreman snapshot) and
// foreman-throughput (delivered hours). This is the per-job
// 'who's been running this' assignment view.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Job } from './job';

export interface ForemanShareEntry {
  foremanId: string;
  drCount: number;
  share: number;
}

export interface JobForemanAssignmentRow {
  jobId: string;
  projectName: string;
  totalDrs: number;
  primaryForemanId: string | null;
  primaryShare: number;
  distinctForemen: number;
  /** All foremen on the job, sorted by drCount desc. */
  foremen: ForemanShareEntry[];
}

export interface JobForemanAssignmentRollup {
  jobsConsidered: number;
  totalDrs: number;
  /** Jobs with primary share < 0.6 — unstable leadership. */
  jobsWithRotatingLeadership: number;
}

export interface JobForemanAssignmentInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  reports: DailyReport[];
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
  /** Optional yyyy-mm-dd window applied to DR.date. */
  fromDate?: string;
  toDate?: string;
  /** Threshold below which primary share counts as 'rotating'.
   *  Default 0.6. */
  rotatingThreshold?: number;
}

export function buildJobForemanAssignment(
  inputs: JobForemanAssignmentInputs,
): {
  rollup: JobForemanAssignmentRollup;
  rows: JobForemanAssignmentRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;
  const rotatingThreshold = inputs.rotatingThreshold ?? 0.6;

  const reports = inputs.reports.filter((r) => {
    if (!r.submitted) return false;
    if (inputs.fromDate && r.date < inputs.fromDate) return false;
    if (inputs.toDate && r.date > inputs.toDate) return false;
    return true;
  });

  // Per-job per-foreman count.
  const byJob = new Map<string, Map<string, number>>();
  for (const r of reports) {
    const m = byJob.get(r.jobId) ?? new Map<string, number>();
    m.set(r.foremanId, (m.get(r.foremanId) ?? 0) + 1);
    byJob.set(r.jobId, m);
  }

  let totalDrs = 0;
  let rotating = 0;

  const rows: JobForemanAssignmentRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const m = byJob.get(j.id) ?? new Map<string, number>();
    const total = Array.from(m.values()).reduce((acc, n) => acc + n, 0);
    const foremen: ForemanShareEntry[] = Array.from(m.entries())
      .map(([foremanId, drCount]) => ({
        foremanId,
        drCount,
        share: total === 0 ? 0 : Math.round((drCount / total) * 10_000) / 10_000,
      }))
      .sort((a, b) => b.drCount - a.drCount);

    const primary = foremen[0];
    const primaryShare = primary?.share ?? 0;

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      totalDrs: total,
      primaryForemanId: primary?.foremanId ?? null,
      primaryShare,
      distinctForemen: foremen.length,
      foremen,
    });

    totalDrs += total;
    if (total > 0 && primaryShare < rotatingThreshold) rotating += 1;
  }

  // Sort: most DRs first to surface the busiest jobs.
  rows.sort((a, b) => {
    if (a.totalDrs !== b.totalDrs) return b.totalDrs - a.totalDrs;
    return a.primaryShare - b.primaryShare;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalDrs,
      jobsWithRotatingLeadership: rotating,
    },
    rows,
  };
}
