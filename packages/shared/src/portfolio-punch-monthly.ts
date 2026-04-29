// Portfolio punch-list activity by month.
//
// Plain English: per yyyy-mm, count punch items identified
// (using identifiedOn) and items closed (using closedOn).
// Identified split by severity (SAFETY / MAJOR / MINOR).
// Drives the closeout review.
//
// Per row: month, identified, closed, identifiedBySeverity,
// distinctJobs.
//
// Sort: month asc.
//
// Different from punch-list-aging (per-item age),
// punch-list-by-job-monthly (per job axis), punch-closeout-
// velocity (per-item close timing).
//
// Pure derivation. No persisted records.

import type { PunchItem, PunchItemSeverity } from './punch-list';

export interface PortfolioPunchMonthlyRow {
  month: string;
  identified: number;
  closed: number;
  identifiedBySeverity: Partial<Record<PunchItemSeverity, number>>;
  distinctJobs: number;
}

export interface PortfolioPunchMonthlyRollup {
  monthsConsidered: number;
  totalIdentified: number;
  totalClosed: number;
}

export interface PortfolioPunchMonthlyInputs {
  punchItems: PunchItem[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioPunchMonthly(
  inputs: PortfolioPunchMonthlyInputs,
): {
  rollup: PortfolioPunchMonthlyRollup;
  rows: PortfolioPunchMonthlyRow[];
} {
  type Acc = {
    month: string;
    identified: number;
    closed: number;
    bySeverity: Map<PunchItemSeverity, number>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalIdentified = 0;
  let totalClosed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function get(month: string): Acc {
    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        identified: 0,
        closed: 0,
        bySeverity: new Map(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    return a;
  }

  for (const p of inputs.punchItems) {
    const idMonth = p.identifiedOn.slice(0, 7);
    const inIdWindow =
      (!fromM || idMonth >= fromM) && (!toM || idMonth <= toM);
    if (inIdWindow) {
      const a = get(idMonth);
      a.identified += 1;
      const sev: PunchItemSeverity = p.severity ?? 'MINOR';
      a.bySeverity.set(sev, (a.bySeverity.get(sev) ?? 0) + 1);
      a.jobs.add(p.jobId);
      totalIdentified += 1;
    }

    if (p.closedOn) {
      const closedMonth = p.closedOn.slice(0, 7);
      const inCloseWindow =
        (!fromM || closedMonth >= fromM) && (!toM || closedMonth <= toM);
      if (inCloseWindow) {
        const a = get(closedMonth);
        a.closed += 1;
        a.jobs.add(p.jobId);
        totalClosed += 1;
      }
    }
  }

  const rows: PortfolioPunchMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const identifiedBySeverity: Partial<Record<PunchItemSeverity, number>> = {};
      for (const [k, v] of a.bySeverity) identifiedBySeverity[k] = v;
      return {
        month: a.month,
        identified: a.identified,
        closed: a.closed,
        identifiedBySeverity,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: { monthsConsidered: rows.length, totalIdentified, totalClosed },
    rows,
  };
}
