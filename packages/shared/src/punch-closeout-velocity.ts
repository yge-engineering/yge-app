// Per-job punch close-out velocity.
//
// Plain English: punch-list-aging tells us what's still open and
// how long it's been sitting. This module measures the closed
// items: how fast does each job close out punches once they're
// identified? A job with a 3-day close-out average is well-staffed
// for closeout. A job at 60 days has a closeout problem.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { PunchItem } from './punch-list';

export type CloseoutVelocityFlag =
  | 'FAST'    // avg <14 days closed
  | 'NORMAL'  // 14-29 days
  | 'SLOW'    // 30-59 days
  | 'STUCK'   // 60+ days OR no items closed yet despite items open
  | 'NO_DATA';

export interface CloseoutVelocityRow {
  jobId: string;
  projectName: string;
  itemsIdentified: number;
  itemsClosed: number;
  itemsOpen: number;
  closeoutRate: number; // closed / identified
  avgDaysToClose: number | null;
  flag: CloseoutVelocityFlag;
}

export interface CloseoutVelocityRollup {
  jobsConsidered: number;
  totalIdentified: number;
  totalClosed: number;
  fast: number;
  normal: number;
  slow: number;
  stuck: number;
  noData: number;
}

export interface CloseoutVelocityInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  punchItems: PunchItem[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildPunchCloseoutVelocity(
  inputs: CloseoutVelocityInputs,
): {
  rollup: CloseoutVelocityRollup;
  rows: CloseoutVelocityRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const byJob = new Map<string, PunchItem[]>();
  for (const p of inputs.punchItems) {
    const list = byJob.get(p.jobId) ?? [];
    list.push(p);
    byJob.set(p.jobId, list);
  }

  const rows: CloseoutVelocityRow[] = [];
  const counts = { fast: 0, normal: 0, slow: 0, stuck: 0, noData: 0 };
  let totalIdentified = 0;
  let totalClosed = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const items = byJob.get(j.id) ?? [];
    const identified = items.length;
    let closed = 0;
    let totalDays = 0;
    let closedWithDates = 0;
    for (const p of items) {
      if (p.status === 'CLOSED' && p.closedOn) {
        const idDate = parseDate(p.identifiedOn);
        const closeDate = parseDate(p.closedOn);
        if (idDate && closeDate) {
          totalDays += Math.max(0, daysBetween(idDate, closeDate));
          closedWithDates += 1;
        }
        closed += 1;
      } else if (p.status === 'CLOSED') {
        // closed but no closedOn — count as closed but skip avg.
        closed += 1;
      }
    }
    const open = identified - closed;
    const avg = closedWithDates === 0 ? null : totalDays / closedWithDates;
    const closeRate = identified === 0 ? 0 : closed / identified;

    let flag: CloseoutVelocityFlag;
    if (identified === 0) {
      flag = 'NO_DATA';
    } else if (closed === 0 && open > 0) {
      flag = 'STUCK';
    } else if (avg === null) {
      flag = 'NO_DATA';
    } else if (avg < 14) flag = 'FAST';
    else if (avg < 30) flag = 'NORMAL';
    else if (avg < 60) flag = 'SLOW';
    else flag = 'STUCK';

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      itemsIdentified: identified,
      itemsClosed: closed,
      itemsOpen: open,
      closeoutRate: round4(closeRate),
      avgDaysToClose: avg === null ? null : round1(avg),
      flag,
    });
    totalIdentified += identified;
    totalClosed += closed;

    if (flag === 'FAST') counts.fast += 1;
    else if (flag === 'NORMAL') counts.normal += 1;
    else if (flag === 'SLOW') counts.slow += 1;
    else if (flag === 'STUCK') counts.stuck += 1;
    else counts.noData += 1;
  }

  // STUCK first, then SLOW, NORMAL, FAST; NO_DATA last.
  const tierRank: Record<CloseoutVelocityFlag, number> = {
    STUCK: 0,
    SLOW: 1,
    NORMAL: 2,
    FAST: 3,
    NO_DATA: 4,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    const ad = a.avgDaysToClose ?? -1;
    const bd = b.avgDaysToClose ?? -1;
    return bd - ad;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalIdentified,
      totalClosed,
      ...counts,
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
