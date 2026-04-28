// Per-job dispatch posting lateness.
//
// Plain English: every dispatch carries a scheduledFor (the day
// the work happens) and a postedAt (when Brook clicked POST in
// the office). The window between those two timestamps is when
// the crew sees their assignment.
//
// Posted the night before? Crew has time to fuel up, pull tools,
// load the trailer. Posted the morning of? Crew shows up at the
// yard cold. Posted same-day after the shift starts? Foreman is
// guessing.
//
// This module surfaces, per AWARDED job:
//   - count of POSTED dispatches
//   - count posted "in time" (>= 12 hours before scheduledFor)
//   - count posted "late" (between 0 and 12 hours before)
//   - count posted "after start" (postedAt > scheduledFor 06:00)
//   - median posting lead time in hours
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export interface JobDispatchLatenessRow {
  jobId: string;
  projectName: string;
  postedDispatches: number;
  postedInTime: number;
  postedLate: number;
  postedAfterStart: number;
  /** Median posting lead time in hours. Negative = posted after
   *  the day's 06:00 start. Null when no postedAt timestamps. */
  medianLeadHours: number | null;
  /** Posted-in-time as a fraction of total. 0 when no postings. */
  inTimeShare: number;
}

export interface JobDispatchLatenessRollup {
  jobsConsidered: number;
  totalPosted: number;
  totalInTime: number;
  totalLate: number;
  totalAfterStart: number;
  blendedInTimeShare: number;
}

export interface JobDispatchLatenessInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  dispatches: Dispatch[];
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
  /** Hours before scheduledFor's 06:00 start that count as
   *  'in time'. Default 12 (so a 6 PM previous-day post is
   *  in-time). */
  inTimeHours?: number;
}

export function buildJobDispatchPostingLateness(
  inputs: JobDispatchLatenessInputs,
): {
  rollup: JobDispatchLatenessRollup;
  rows: JobDispatchLatenessRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;
  const inTimeHours = inputs.inTimeHours ?? 12;

  // Bucket dispatches by job. Only POSTED + COMPLETED (post-event)
  // dispatches that actually have a postedAt are scored.
  const byJob = new Map<string, Dispatch[]>();
  for (const d of inputs.dispatches) {
    if (!d.postedAt) continue;
    if (d.status === 'DRAFT' || d.status === 'CANCELLED') continue;
    const list = byJob.get(d.jobId) ?? [];
    list.push(d);
    byJob.set(d.jobId, list);
  }

  let totalPosted = 0;
  let totalInTime = 0;
  let totalLate = 0;
  let totalAfterStart = 0;

  const rows: JobDispatchLatenessRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const ds = byJob.get(j.id) ?? [];
    let inTime = 0;
    let late = 0;
    let afterStart = 0;
    const leadHours: number[] = [];

    for (const d of ds) {
      const posted = d.postedAt;
      if (!posted) continue;
      const start = scheduledStartIso(d.scheduledFor);
      const lead = hoursBetween(posted, start);
      leadHours.push(lead);
      if (lead < 0) afterStart += 1;
      else if (lead < inTimeHours) late += 1;
      else inTime += 1;
    }

    const medianLead = leadHours.length === 0 ? null : computeMedian(leadHours);
    const total = ds.length;
    const share = total === 0 ? 0 : Math.round((inTime / total) * 10_000) / 10_000;

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      postedDispatches: total,
      postedInTime: inTime,
      postedLate: late,
      postedAfterStart: afterStart,
      medianLeadHours: medianLead,
      inTimeShare: share,
    });

    totalPosted += total;
    totalInTime += inTime;
    totalLate += late;
    totalAfterStart += afterStart;
  }

  rows.sort((a, b) => {
    // Lowest in-time share first (most attention needed).
    if (a.inTimeShare !== b.inTimeShare) return a.inTimeShare - b.inTimeShare;
    return b.postedDispatches - a.postedDispatches;
  });

  const blended = totalPosted === 0
    ? 0
    : Math.round((totalInTime / totalPosted) * 10_000) / 10_000;

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalPosted,
      totalInTime,
      totalLate,
      totalAfterStart,
      blendedInTimeShare: blended,
    },
    rows,
  };
}

function scheduledStartIso(scheduledFor: string): string {
  // Treat the day's start as 06:00 UTC for math. Crews start early
  // on heavy-civil; this is the threshold rather than 00:00.
  return `${scheduledFor}T06:00:00.000Z`;
}

function hoursBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round(((b - a) / (1000 * 60 * 60)) * 100) / 100;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return Math.round(((a + b) / 2) * 100) / 100;
}
