// Per-job RFI priority distribution.
//
// Plain English: every RFI carries a priority (LOW / MEDIUM /
// HIGH / CRITICAL). For each AWARDED job, count how many of each
// priority and what the open-vs-answered split is. A job loaded
// with HIGH and CRITICAL RFIs that are still SENT (unanswered)
// is a job in trouble — the engineer of record is bottlenecking
// the work.
//
// Different from rfi-board (portfolio status board), job-rfi-age
// (per-RFI age), and job-rfi-to-co (RFI → CO conversion).
// This is the per-job priority-mix snapshot.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Rfi, RfiPriority } from './rfi';

export interface JobRfiPriorityMixRow {
  jobId: string;
  projectName: string;
  total: number;
  /** Counts by priority. Always present. */
  low: number;
  medium: number;
  high: number;
  critical: number;
  /** RFIs in SENT status (waiting on engineer). */
  openCount: number;
  /** Open AND HIGH or CRITICAL — most actionable. */
  openHighCritical: number;
  /** Sum of HIGH + CRITICAL counts (any status). */
  totalHighCritical: number;
}

export interface JobRfiPriorityMixRollup {
  jobsConsidered: number;
  totalRfis: number;
  totalOpen: number;
  totalOpenHighCritical: number;
}

export interface JobRfiPriorityMixInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  rfis: Rfi[];
  /** Default false — only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobRfiPriorityMix(
  inputs: JobRfiPriorityMixInputs,
): {
  rollup: JobRfiPriorityMixRollup;
  rows: JobRfiPriorityMixRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const byJob = new Map<string, Rfi[]>();
  for (const r of inputs.rfis) {
    const list = byJob.get(r.jobId) ?? [];
    list.push(r);
    byJob.set(r.jobId, list);
  }

  let totalRfis = 0;
  let totalOpen = 0;
  let totalOpenHighCritical = 0;

  const rows: JobRfiPriorityMixRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const rs = byJob.get(j.id) ?? [];

    const counts: Record<RfiPriority, number> = {
      LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
    };
    let open = 0;
    let openHC = 0;

    for (const r of rs) {
      counts[r.priority] += 1;
      if (r.status === 'SENT') {
        open += 1;
        if (r.priority === 'HIGH' || r.priority === 'CRITICAL') openHC += 1;
      }
    }

    const totalHC = counts.HIGH + counts.CRITICAL;

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      total: rs.length,
      low: counts.LOW,
      medium: counts.MEDIUM,
      high: counts.HIGH,
      critical: counts.CRITICAL,
      openCount: open,
      openHighCritical: openHC,
      totalHighCritical: totalHC,
    });

    totalRfis += rs.length;
    totalOpen += open;
    totalOpenHighCritical += openHC;
  }

  // Sort: most open-high-critical first, then by openCount desc.
  rows.sort((a, b) => {
    if (a.openHighCritical !== b.openHighCritical) {
      return b.openHighCritical - a.openHighCritical;
    }
    if (a.openCount !== b.openCount) return b.openCount - a.openCount;
    return b.total - a.total;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalRfis,
      totalOpen,
      totalOpenHighCritical,
    },
    rows,
  };
}
