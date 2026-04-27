// Cost-to-complete + Estimate-at-Completion forecast (Earned Value Mgmt).
//
// Plain English: at any point during a job, three numbers tell you
// whether it's bleeding:
//
//   1. Budget At Completion (BAC) — what you priced the work at.
//   2. Actual Cost (AC) — what you've spent so far.
//   3. Earned Value (EV) — the % complete × BAC. The "value" of the
//      work physically done so far at original budgeted rates.
//
// From those, the standard EVM trio:
//
//   - CPI (Cost Performance Index) = EV / AC.
//     >1 = under budget, =1 = on budget, <1 = over budget.
//   - FEAC (Forecast Estimate At Completion) = AC + (BAC - EV) / CPI.
//     Projects what the job will cost if the rest of the work
//     continues at the same cost performance.
//   - ETC (Estimate To Complete) = FEAC - AC. The remaining $ needed.
//   - VAC (Variance At Completion) = BAC - FEAC. Positive = under
//     budget at completion. Negative = over budget at completion.
//
// This is the math sureties and banks expect quarterly. Pure
// derivation off WIP rows — caller computes WIP, this module
// chains downstream of it.

import type { WipRow } from './wip';

export type CostForecastFlag =
  | 'ON_TRACK'    // CPI >= 0.95
  | 'AT_RISK'     // 0.85 <= CPI < 0.95
  | 'OVER_BUDGET' // CPI < 0.85
  | 'COMPLETE';   // % complete >= 100

export interface CostForecastRow {
  jobId: string;
  projectName: string;

  /** BAC — original/budgeted cost at completion (cents). */
  budgetAtCompletionCents: number;
  /** AC — actual cost incurred to date (cents). */
  actualCostCents: number;
  /** Reported % complete on the WIP row, 0..1. */
  percentComplete: number;
  /** EV — earned value (cents). */
  earnedValueCents: number;

  /** CPI — cost performance index. 1 = on budget, >1 = under,
   *  <1 = over. Set to 1 when AC == 0 (we haven't spent anything yet). */
  costPerformanceIndex: number;
  /** FEAC — projected total cost at completion (cents). */
  forecastEacCents: number;
  /** ETC — cost to complete (cents). 0 if FEAC <= AC. */
  costToCompleteCents: number;
  /** VAC — variance at completion (cents). Positive = under budget,
   *  negative = projected overrun. */
  varianceAtCompletionCents: number;

  flag: CostForecastFlag;
}

export interface CostForecastRollup {
  jobs: number;
  totalBudgetAtCompletionCents: number;
  totalActualCostCents: number;
  totalEarnedValueCents: number;
  totalForecastEacCents: number;
  totalCostToCompleteCents: number;
  totalVarianceAtCompletionCents: number;
  /** Blended CPI = totalEV / totalAC. */
  blendedCostPerformanceIndex: number;
  /** Number of rows in OVER_BUDGET. */
  overBudgetJobCount: number;
}

/** Build the forecast rows from existing WIP rows. */
export function buildCostForecast(wipRows: WipRow[]): {
  rows: CostForecastRow[];
  rollup: CostForecastRollup;
} {
  const rows: CostForecastRow[] = [];

  for (const w of wipRows) {
    const bac = w.estimatedCostAtCompletionCents;
    const ac = w.costsIncurredCents;
    const pct = clamp01(w.percentComplete);
    const ev = Math.round(bac * pct);

    // CPI: when AC=0, no cost data → assume neutral (1).
    let cpi: number;
    if (ac === 0) cpi = 1;
    else cpi = ev / ac;

    // FEAC: when CPI=0 (no progress reported yet) the standard
    // formula divides by zero. Fall back to the simpler EAC = AC +
    // (BAC - EV) (assumes remaining cost will match budget).
    let feac: number;
    if (cpi <= 0 || !Number.isFinite(cpi)) {
      feac = Math.max(bac, ac);
    } else if (pct >= 1) {
      // Job is reportedly complete — FEAC IS the actual cost.
      feac = ac;
    } else {
      feac = Math.round(ac + (bac - ev) / cpi);
    }

    const etc = Math.max(0, feac - ac);
    const vac = bac - feac;

    let flag: CostForecastFlag;
    if (pct >= 1) flag = 'COMPLETE';
    else if (cpi >= 0.95) flag = 'ON_TRACK';
    else if (cpi >= 0.85) flag = 'AT_RISK';
    else flag = 'OVER_BUDGET';

    rows.push({
      jobId: w.jobId,
      projectName: w.projectName,
      budgetAtCompletionCents: bac,
      actualCostCents: ac,
      percentComplete: pct,
      earnedValueCents: ev,
      costPerformanceIndex: round4(cpi),
      forecastEacCents: feac,
      costToCompleteCents: etc,
      varianceAtCompletionCents: vac,
      flag,
    });
  }

  // Worst CPI first — bleeders to the top.
  rows.sort((a, b) => {
    // COMPLETE jobs to the bottom; we can't act on those any more.
    if (a.flag === 'COMPLETE' && b.flag !== 'COMPLETE') return 1;
    if (b.flag === 'COMPLETE' && a.flag !== 'COMPLETE') return -1;
    return a.costPerformanceIndex - b.costPerformanceIndex;
  });

  let totalBudgetAtCompletionCents = 0;
  let totalActualCostCents = 0;
  let totalEarnedValueCents = 0;
  let totalForecastEacCents = 0;
  let totalCostToCompleteCents = 0;
  let totalVarianceAtCompletionCents = 0;
  let overBudgetJobCount = 0;
  for (const r of rows) {
    totalBudgetAtCompletionCents += r.budgetAtCompletionCents;
    totalActualCostCents += r.actualCostCents;
    totalEarnedValueCents += r.earnedValueCents;
    totalForecastEacCents += r.forecastEacCents;
    totalCostToCompleteCents += r.costToCompleteCents;
    totalVarianceAtCompletionCents += r.varianceAtCompletionCents;
    if (r.flag === 'OVER_BUDGET') overBudgetJobCount += 1;
  }

  const blendedCostPerformanceIndex =
    totalActualCostCents === 0 ? 1 : totalEarnedValueCents / totalActualCostCents;

  return {
    rows,
    rollup: {
      jobs: rows.length,
      totalBudgetAtCompletionCents,
      totalActualCostCents,
      totalEarnedValueCents,
      totalForecastEacCents,
      totalCostToCompleteCents,
      totalVarianceAtCompletionCents,
      blendedCostPerformanceIndex: round4(blendedCostPerformanceIndex),
      overBudgetJobCount,
    },
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
