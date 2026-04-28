// Per-job submittal pipeline view.
//
// Plain English: for each AWARDED job, the snapshot of every
// submittal in the system grouped by where it sits in the
// SUBMITTED → APPROVED / APPROVED_AS_NOTED / REVISE_RESUBMIT /
// REJECTED pipeline. Surfaces:
//   - count by status
//   - count of in-flight (SUBMITTED, waiting on engineer)
//   - count past responseDueAt (the engineer is sitting on it)
//   - oldest in-flight age in days vs asOf
//   - average cycle time across completed (submittedAt → returnedAt)
//   - count blocking ordering / fabrication
//
// Different from submittal-board (portfolio-wide list view) and
// submittal-turnaround (per-vendor / per-engineer turnaround
// metrics). This is the per-job glance that answers "where do we
// stand on this job's submittals right now?"
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Submittal, SubmittalStatus } from './submittal';

export interface JobSubmittalPipelineRow {
  jobId: string;
  projectName: string;
  total: number;
  /** Status counts. Always present even when zero so the UI can
   *  pin column widths. */
  draft: number;
  submitted: number;
  approved: number;
  approvedAsNoted: number;
  reviseResubmit: number;
  rejected: number;
  withdrawn: number;
  /** SUBMITTED whose responseDueAt < asOf — engineer overdue. */
  pastDueCount: number;
  /** Oldest SUBMITTED submittal age in days from submittedAt to
   *  asOf. Null when none in flight. */
  oldestInFlightDays: number | null;
  /** Submittals where blocksOrdering = true AND status is SUBMITTED
   *  or REVISE_RESUBMIT (not yet usable). Counts the urgency. */
  blockingOrdering: number;
  /** Average cycle time (submittedAt → returnedAt) across submittals
   *  with both dates populated. Null when zero. */
  avgCycleDays: number | null;
}

export interface JobSubmittalPipelineRollup {
  jobsConsidered: number;
  totalSubmittals: number;
  totalInFlight: number;
  totalPastDue: number;
  totalBlockingOrdering: number;
}

export interface JobSubmittalPipelineInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  submittals: Submittal[];
  /** asOf yyyy-mm-dd for past-due + age math. Defaults to today
   *  derived from the latest submittedAt observed; falls back to
   *  '1970-01-01'. */
  asOf?: string;
  /** Default false — only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobSubmittalPipeline(
  inputs: JobSubmittalPipelineInputs,
): {
  rollup: JobSubmittalPipelineRollup;
  rows: JobSubmittalPipelineRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // asOf default: latest submittedAt seen, fallback to 1970-01-01.
  let asOf = inputs.asOf;
  if (!asOf) {
    let latest = '';
    for (const s of inputs.submittals) {
      if (s.submittedAt && s.submittedAt > latest) latest = s.submittedAt;
    }
    asOf = latest || '1970-01-01';
  }

  // Bucket submittals by jobId.
  const subsByJob = new Map<string, Submittal[]>();
  for (const s of inputs.submittals) {
    const list = subsByJob.get(s.jobId) ?? [];
    list.push(s);
    subsByJob.set(s.jobId, list);
  }

  let totalInFlight = 0;
  let totalPastDue = 0;
  let totalBlocking = 0;
  let totalSubmittals = 0;

  const rows: JobSubmittalPipelineRow[] = [];

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const subs = subsByJob.get(j.id) ?? [];

    const counts: Record<SubmittalStatus, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      APPROVED: 0,
      APPROVED_AS_NOTED: 0,
      REVISE_RESUBMIT: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    };

    let pastDue = 0;
    let oldestInFlight: number | null = null;
    let blocking = 0;
    const cycleDays: number[] = [];

    for (const s of subs) {
      counts[s.status] += 1;

      if (s.status === 'SUBMITTED') {
        if (s.submittedAt) {
          const age = daysBetween(s.submittedAt, asOf);
          if (age >= 0 && (oldestInFlight === null || age > oldestInFlight)) {
            oldestInFlight = age;
          }
        }
        if (s.responseDueAt && s.responseDueAt < asOf) pastDue += 1;
      }

      if (s.blocksOrdering && (s.status === 'SUBMITTED' || s.status === 'REVISE_RESUBMIT')) {
        blocking += 1;
      }

      if (s.submittedAt && s.returnedAt) {
        const days = daysBetween(s.submittedAt, s.returnedAt);
        if (days >= 0) cycleDays.push(days);
      }
    }

    const avgCycle = cycleDays.length === 0
      ? null
      : Math.round((cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) * 10) / 10;

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      total: subs.length,
      draft: counts.DRAFT,
      submitted: counts.SUBMITTED,
      approved: counts.APPROVED,
      approvedAsNoted: counts.APPROVED_AS_NOTED,
      reviseResubmit: counts.REVISE_RESUBMIT,
      rejected: counts.REJECTED,
      withdrawn: counts.WITHDRAWN,
      pastDueCount: pastDue,
      oldestInFlightDays: oldestInFlight,
      blockingOrdering: blocking,
      avgCycleDays: avgCycle,
    });

    totalSubmittals += subs.length;
    totalInFlight += counts.SUBMITTED;
    totalPastDue += pastDue;
    totalBlocking += blocking;
  }

  // Sort: most blocking ordering first, then most past-due, then most
  // in-flight, then by total desc.
  rows.sort((a, b) => {
    if (a.blockingOrdering !== b.blockingOrdering) {
      return b.blockingOrdering - a.blockingOrdering;
    }
    if (a.pastDueCount !== b.pastDueCount) return b.pastDueCount - a.pastDueCount;
    if (a.submitted !== b.submitted) return b.submitted - a.submitted;
    return b.total - a.total;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalSubmittals,
      totalInFlight,
      totalPastDue,
      totalBlockingOrdering: totalBlocking,
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
