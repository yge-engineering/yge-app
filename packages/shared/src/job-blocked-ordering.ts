// Per-job blocked-ordering submittals.
//
// Plain English: when a submittal flagged blocksOrdering = true
// is sitting in SUBMITTED or REVISE_RESUBMIT status, the
// fabricator / supplier can't release the order. Long lead-time
// items (custom rebar, structural steel, switchgear) failing
// this gate are how a job ends up six weeks behind schedule
// without anyone noticing until it's too late.
//
// Per AWARDED job: an itemized list of submittals currently
// blocking ordering, each with submittedAt, age, leadTimeNote,
// and the spec section. The list is sorted oldest-first within
// each job; jobs are sorted by total blocked count desc.
//
// Different from job-submittal-pipeline (per-job status counts)
// and submittal-board (portfolio list). This is the focused
// procurement-blocker queue Brook uses to know what to chase
// the engineer about today.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Submittal } from './submittal';

export interface BlockedOrderingItem {
  submittalId: string;
  submittalNumber: string;
  revision: string | null;
  subject: string;
  specSection: string | null;
  status: Submittal['status'];
  submittedAt: string | null;
  ageDays: number | null;
  leadTimeNote: string | null;
}

export interface JobBlockedOrderingRow {
  jobId: string;
  projectName: string;
  blockedCount: number;
  /** Oldest blocked submittal age in days. Null when zero blocked. */
  oldestBlockedDays: number | null;
  items: BlockedOrderingItem[];
}

export interface JobBlockedOrderingRollup {
  jobsConsidered: number;
  jobsWithBlocked: number;
  totalBlocked: number;
}

export interface JobBlockedOrderingInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  submittals: Submittal[];
  /** asOf yyyy-mm-dd for age math. Defaults to latest submittedAt. */
  asOf?: string;
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
}

export function buildJobBlockedOrdering(
  inputs: JobBlockedOrderingInputs,
): {
  rollup: JobBlockedOrderingRollup;
  rows: JobBlockedOrderingRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  let asOf = inputs.asOf;
  if (!asOf) {
    let latest = '';
    for (const s of inputs.submittals) {
      if (s.submittedAt && s.submittedAt > latest) latest = s.submittedAt;
    }
    asOf = latest || '1970-01-01';
  }

  // Bucket submittals by job.
  const byJob = new Map<string, Submittal[]>();
  for (const s of inputs.submittals) {
    if (!s.blocksOrdering) continue;
    if (s.status !== 'SUBMITTED' && s.status !== 'REVISE_RESUBMIT') continue;
    const list = byJob.get(s.jobId) ?? [];
    list.push(s);
    byJob.set(s.jobId, list);
  }

  let totalBlocked = 0;
  let jobsWithBlocked = 0;

  const rows: JobBlockedOrderingRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const subs = byJob.get(j.id) ?? [];
    const items: BlockedOrderingItem[] = subs.map((s) => {
      const age = s.submittedAt ? daysBetween(s.submittedAt, asOf) : null;
      return {
        submittalId: s.id,
        submittalNumber: s.submittalNumber,
        revision: s.revision ?? null,
        subject: s.subject,
        specSection: s.specSection ?? null,
        status: s.status,
        submittedAt: s.submittedAt ?? null,
        ageDays: age,
        leadTimeNote: s.leadTimeNote ?? null,
      };
    });
    // Sort items oldest-first.
    items.sort((a, b) => {
      const ax = a.ageDays ?? -1;
      const bx = b.ageDays ?? -1;
      return bx - ax;
    });

    const oldest = items.length === 0
      ? null
      : (items[0]?.ageDays ?? null);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      blockedCount: items.length,
      oldestBlockedDays: oldest,
      items,
    });

    if (items.length > 0) jobsWithBlocked += 1;
    totalBlocked += items.length;
  }

  // Sort jobs: most blocked first; tie-break by oldest age desc.
  rows.sort((a, b) => {
    if (a.blockedCount !== b.blockedCount) return b.blockedCount - a.blockedCount;
    return (b.oldestBlockedDays ?? -1) - (a.oldestBlockedDays ?? -1);
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      jobsWithBlocked,
      totalBlocked,
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
