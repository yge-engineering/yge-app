// Per-job RFI age summary.
//
// Plain English: rfi-board gives the cross-job dashboard. This
// module flips it: for each AWARDED job, count of open RFIs
// bucketed by age, plus the oldest open RFI date. One row per
// job for the project-detail page header.
//
// RFI status meaning:
//   - SENT       open, awaiting answer (the buckets we count)
//   - ANSWERED   answered but possibly not closed; not "open"
//   - CLOSED     done
//   - WITHDRAWN  abandoned
//   - DRAFT      not yet sent
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Rfi } from './rfi';

export type RfiAgeBucket = 'FRESH' | 'AGING' | 'STALE' | 'STUCK';

export interface JobRfiAgeRow {
  jobId: string;
  projectName: string;
  openRfiCount: number;
  fresh: number;
  aging: number;
  stale: number;
  stuck: number;
  /** sentAt of the oldest open (SENT) RFI on this job, or null. */
  oldestOpenSentAt: string | null;
  oldestOpenDaysSinceSent: number | null;
}

export interface JobRfiAgeRollup {
  jobsConsidered: number;
  totalOpen: number;
  totalFresh: number;
  totalAging: number;
  totalStale: number;
  totalStuck: number;
  /** Jobs with at least one STUCK open RFI. */
  stuckJobsCount: number;
}

export interface JobRfiAgeInputs {
  asOf?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  rfis: Rfi[];
  /** When false (default), only AWARDED jobs counted. */
  includeAllStatuses?: boolean;
}

export function buildJobRfiAge(inputs: JobRfiAgeInputs): {
  rollup: JobRfiAgeRollup;
  rows: JobRfiAgeRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const includeAll = inputs.includeAllStatuses === true;

  // Group open (SENT) RFIs by job.
  const byJob = new Map<string, Rfi[]>();
  for (const r of inputs.rfis) {
    if (r.status !== 'SENT') continue;
    const list = byJob.get(r.jobId) ?? [];
    list.push(r);
    byJob.set(r.jobId, list);
  }

  const rows: JobRfiAgeRow[] = [];
  let totalOpen = 0;
  let totalFresh = 0;
  let totalAging = 0;
  let totalStale = 0;
  let totalStuck = 0;
  let stuckJobsCount = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const open = byJob.get(j.id) ?? [];
    let fresh = 0;
    let aging = 0;
    let stale = 0;
    let stuck = 0;
    let oldestSent: string | null = null;
    let oldestDays: number | null = null;
    for (const r of open) {
      const sentRaw = r.sentAt ?? r.updatedAt;
      const sentDate = parseIsoDate(sentRaw);
      if (!sentDate) continue;
      const days = Math.max(0, daysBetween(sentDate, refNow));
      if (days < 7) fresh += 1;
      else if (days < 14) aging += 1;
      else if (days < 30) stale += 1;
      else stuck += 1;
      const sentDay = sentRaw.slice(0, 10);
      if (oldestSent === null || sentDay < oldestSent) {
        oldestSent = sentDay;
        oldestDays = days;
      }
    }
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      openRfiCount: open.length,
      fresh,
      aging,
      stale,
      stuck,
      oldestOpenSentAt: oldestSent,
      oldestOpenDaysSinceSent: oldestDays,
    });
    totalOpen += open.length;
    totalFresh += fresh;
    totalAging += aging;
    totalStale += stale;
    totalStuck += stuck;
    if (stuck > 0) stuckJobsCount += 1;
  }

  // Most-stuck job first; tied by most open count.
  rows.sort((a, b) => {
    if (a.stuck !== b.stuck) return b.stuck - a.stuck;
    return b.openRfiCount - a.openRfiCount;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalOpen,
      totalFresh,
      totalAging,
      totalStale,
      totalStuck,
      stuckJobsCount,
    },
    rows,
  };
}

function parseIsoDate(s: string): Date | null {
  const head = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null;
  const d = new Date(`${head}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
