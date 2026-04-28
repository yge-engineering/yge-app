// Per-job AP vs cost-budget.
//
// Plain English: simple but high-impact. Caller passes in the
// estimated cost-at-completion budget per job; module sums non-
// DRAFT/non-REJECTED AP totals against the same job. Spits out
// the % consumed and a tier ladder so over-budget jobs surface
// before the next billing cycle.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

export type BudgetFlag =
  | 'UNDER'        // <80% consumed
  | 'NEAR_BUDGET'  // 80-100%
  | 'OVER'         // 100-115%
  | 'BLOWN'        // >115%
  | 'NO_BUDGET';

export interface JobApBudgetRow {
  jobId: string;
  projectName: string;
  budgetCents: number;
  apToDateCents: number;
  remainingCents: number;
  consumedPct: number;
  flag: BudgetFlag;
}

export interface JobApBudgetRollup {
  jobsConsidered: number;
  totalBudgetCents: number;
  totalApCents: number;
  under: number;
  nearBudget: number;
  over: number;
  blown: number;
  noBudget: number;
  /** Total $ over budget across OVER + BLOWN. */
  totalOverageCents: number;
}

export interface JobApBudgetInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  apInvoices: ApInvoice[];
  /** Map<jobId, budget cents>. */
  budgetByJobId: Map<string, number>;
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobApVsBudget(inputs: JobApBudgetInputs): {
  rollup: JobApBudgetRollup;
  rows: JobApBudgetRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // AP totals per job.
  const apByJob = new Map<string, number>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inv.jobId) continue;
    apByJob.set(inv.jobId, (apByJob.get(inv.jobId) ?? 0) + inv.totalCents);
  }

  const rows: JobApBudgetRow[] = [];
  const counts = { under: 0, nearBudget: 0, over: 0, blown: 0, noBudget: 0 };
  let totalBudget = 0;
  let totalAp = 0;
  let totalOverage = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const budget = inputs.budgetByJobId.get(j.id) ?? 0;
    const ap = apByJob.get(j.id) ?? 0;
    const consumed = budget === 0 ? 0 : ap / budget;

    let flag: BudgetFlag;
    if (budget === 0) flag = 'NO_BUDGET';
    else if (consumed > 1.15) flag = 'BLOWN';
    else if (consumed > 1.0) flag = 'OVER';
    else if (consumed >= 0.8) flag = 'NEAR_BUDGET';
    else flag = 'UNDER';

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      budgetCents: budget,
      apToDateCents: ap,
      remainingCents: budget - ap,
      consumedPct: round4(consumed),
      flag,
    });

    totalBudget += budget;
    totalAp += ap;
    if (flag === 'UNDER') counts.under += 1;
    else if (flag === 'NEAR_BUDGET') counts.nearBudget += 1;
    else if (flag === 'OVER') counts.over += 1;
    else if (flag === 'BLOWN') counts.blown += 1;
    else counts.noBudget += 1;
    if (flag === 'OVER' || flag === 'BLOWN') totalOverage += ap - budget;
  }

  // BLOWN first, then OVER, NEAR_BUDGET, UNDER; NO_BUDGET last.
  const tierRank: Record<BudgetFlag, number> = {
    BLOWN: 0,
    OVER: 1,
    NEAR_BUDGET: 2,
    UNDER: 3,
    NO_BUDGET: 4,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return b.consumedPct - a.consumedPct;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalBudgetCents: totalBudget,
      totalApCents: totalAp,
      ...counts,
      totalOverageCents: totalOverage,
    },
    rows,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
