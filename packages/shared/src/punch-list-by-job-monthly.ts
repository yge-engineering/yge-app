// Per (job, month) punch list activity rollup.
//
// Plain English: each punch item has identifiedOn (when added)
// and optional closedOn (when resolved). For each (jobId,
// yyyy-mm) bucket count items identified that month, items
// closed that month, and split severity (SAFETY / MAJOR /
// MINOR) on the identified side. Tells YGE the punch-list
// burn-down month over month per job.
//
// Per row: jobId, month, identified, closed, identifiedBySeverity.
//
// Sort: jobId asc, month asc.
//
// Different from punch-list-aging (per-item age),
// punch-board (active list), punch-closeout-velocity (close
// timing per item), job-punch-by-responsible (per-job per-
// responsible). This is the per-job time-axis activity view.
//
// Pure derivation. No persisted records.

import type { PunchItem, PunchItemSeverity } from './punch-list';

export interface PunchListByJobMonthlyRow {
  jobId: string;
  month: string;
  identified: number;
  closed: number;
  identifiedBySeverity: Partial<Record<PunchItemSeverity, number>>;
}

export interface PunchListByJobMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalIdentified: number;
  totalClosed: number;
}

export interface PunchListByJobMonthlyInputs {
  punchItems: PunchItem[];
  /** Optional yyyy-mm bounds inclusive applied to identifiedOn / closedOn. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPunchListByJobMonthly(
  inputs: PunchListByJobMonthlyInputs,
): {
  rollup: PunchListByJobMonthlyRollup;
  rows: PunchListByJobMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    identified: number;
    closed: number;
    bySeverity: Map<PunchItemSeverity, number>;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
  const months = new Set<string>();

  let totalIdentified = 0;
  let totalClosed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function get(jobId: string, month: string): Acc {
    const key = `${jobId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        jobId,
        month,
        identified: 0,
        closed: 0,
        bySeverity: new Map(),
      };
      accs.set(key, a);
    }
    return a;
  }

  for (const p of inputs.punchItems) {
    const idMonth = p.identifiedOn.slice(0, 7);
    const inIdWindow =
      (!fromM || idMonth >= fromM) && (!toM || idMonth <= toM);
    if (inIdWindow) {
      const a = get(p.jobId, idMonth);
      a.identified += 1;
      const sev: PunchItemSeverity = p.severity ?? 'MINOR';
      a.bySeverity.set(sev, (a.bySeverity.get(sev) ?? 0) + 1);
      jobs.add(p.jobId);
      months.add(idMonth);
      totalIdentified += 1;
    }

    if (p.closedOn) {
      const closedMonth = p.closedOn.slice(0, 7);
      const inCloseWindow =
        (!fromM || closedMonth >= fromM) && (!toM || closedMonth <= toM);
      if (inCloseWindow) {
        const a = get(p.jobId, closedMonth);
        a.closed += 1;
        jobs.add(p.jobId);
        months.add(closedMonth);
        totalClosed += 1;
      }
    }
  }

  const rows: PunchListByJobMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const identifiedBySeverity: Partial<Record<PunchItemSeverity, number>> = {};
      for (const [k, v] of a.bySeverity) identifiedBySeverity[k] = v;
      return {
        jobId: a.jobId,
        month: a.month,
        identified: a.identified,
        closed: a.closed,
        identifiedBySeverity,
      };
    })
    .sort((x, y) => {
      if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      monthsConsidered: months.size,
      totalIdentified,
      totalClosed,
    },
    rows,
  };
}
