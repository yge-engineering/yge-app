// Job billing pace report.
//
// Plain English: a job that's 50% physically complete should be
// roughly 50% billed. When billed-to-date lags actual progress by a
// lot, YGE is doing the work without invoicing for it — direct cash-
// flow hit. When billed leads progress, you've over-billed (deferred
// income) which is fine for cash but eventually trues up.
//
// This walks each job's actual cost incurred vs estimated cost-at-
// completion (proxies for % complete), and compares to billed-to-
// date / adjusted contract.
//
// Pure derivation. Inputs are the existing job + AR + AP records.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { ChangeOrder } from './change-order';
import type { Job } from './job';

export type BillingPaceFlag =
  | 'UNDER_BILLED_BAD'   // billed share is more than 15% behind cost share
  | 'UNDER_BILLED'       // 5%-15% behind
  | 'ON_PACE'            // within 5% either direction
  | 'OVER_BILLED'        // 5%-15% ahead
  | 'OVER_BILLED_HIGH'   // more than 15% ahead
  | 'NO_BUDGET';         // can't compute (no budget supplied)

export interface BillingPaceRow {
  jobId: string;
  projectName: string;

  /** Original contract + executed COs. Caller supplies. */
  adjustedContractCents: number;
  /** Estimated total cost. Caller supplies. */
  budgetCents: number;
  /** Actual costs incurred (sum of APPROVED/PAID AP for this job). */
  costsIncurredCents: number;
  /** Sum of non-DRAFT, non-WRITTEN_OFF AR invoice totals for this job. */
  billedToDateCents: number;

  /** costsIncurred / budget. Proxy for % complete. 0..1. */
  costShare: number;
  /** billed / adjusted contract. 0..1. */
  billedShare: number;
  /** billedShare - costShare. Positive = over-billed; negative = under. */
  paceDelta: number;
  /** Estimated $ value of the under-billed gap (positive = money YGE
   *  has earned but not invoiced). Negative = over-billed amount. */
  estimatedUnderBilledCents: number;

  flag: BillingPaceFlag;
}

export interface BillingPaceRollup {
  jobs: number;
  /** Sum of estimatedUnderBilledCents where positive only — the
   *  total dollar value YGE has earned but not invoiced. */
  totalUnderBilledCents: number;
  byFlag: Record<BillingPaceFlag, number>;
}

export interface BillingPaceInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  changeOrders: ChangeOrder[];
  /** Map<jobId, original contract value cents>. */
  originalContractByJobId: Map<string, number>;
  /** Map<jobId, estimated cost at completion cents>. */
  budgetByJobId: Map<string, number>;
}

export function buildBillingPaceReport(inputs: BillingPaceInputs): {
  rows: BillingPaceRow[];
  rollup: BillingPaceRollup;
} {
  const { jobs, arInvoices, apInvoices, changeOrders } = inputs;

  // Pre-aggregate per job.
  const billedByJob = new Map<string, number>();
  for (const inv of arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    billedByJob.set(
      inv.jobId,
      (billedByJob.get(inv.jobId) ?? 0) + inv.totalCents,
    );
  }
  const apByJob = new Map<string, number>();
  for (const inv of apInvoices) {
    if (inv.status !== 'APPROVED' && inv.status !== 'PAID' && inv.status !== 'PENDING') continue;
    if (!inv.jobId) continue;
    apByJob.set(
      inv.jobId,
      (apByJob.get(inv.jobId) ?? 0) + inv.totalCents,
    );
  }
  const coByJob = new Map<string, number>();
  for (const co of changeOrders) {
    if (co.status !== 'EXECUTED' && co.status !== 'APPROVED') continue;
    coByJob.set(
      co.jobId,
      (coByJob.get(co.jobId) ?? 0) + co.totalCostImpactCents,
    );
  }

  const rows: BillingPaceRow[] = [];
  for (const j of jobs) {
    const original = inputs.originalContractByJobId.get(j.id) ?? 0;
    const budget = inputs.budgetByJobId.get(j.id) ?? 0;
    const adjustedContract = original + (coByJob.get(j.id) ?? 0);
    const cost = apByJob.get(j.id) ?? 0;
    const billed = billedByJob.get(j.id) ?? 0;

    const costShare = budget === 0 ? 0 : Math.min(1, cost / budget);
    const billedShare =
      adjustedContract === 0 ? 0 : Math.min(1, billed / adjustedContract);
    const paceDelta = billedShare - costShare;
    const estimatedUnderBilledCents =
      adjustedContract === 0
        ? 0
        : Math.round(adjustedContract * (costShare - billedShare));

    let flag: BillingPaceFlag;
    if (budget === 0 || adjustedContract === 0) {
      flag = 'NO_BUDGET';
    } else if (paceDelta < -0.15) {
      flag = 'UNDER_BILLED_BAD';
    } else if (paceDelta < -0.05) {
      flag = 'UNDER_BILLED';
    } else if (paceDelta > 0.15) {
      flag = 'OVER_BILLED_HIGH';
    } else if (paceDelta > 0.05) {
      flag = 'OVER_BILLED';
    } else {
      flag = 'ON_PACE';
    }

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      adjustedContractCents: adjustedContract,
      budgetCents: budget,
      costsIncurredCents: cost,
      billedToDateCents: billed,
      costShare,
      billedShare,
      paceDelta,
      estimatedUnderBilledCents,
      flag,
    });
  }

  // Sort: UNDER_BILLED_BAD first (worst cash hit), most under-billed
  // dollars first within tier. NO_BUDGET pinned at the bottom.
  const tierRank: Record<BillingPaceFlag, number> = {
    UNDER_BILLED_BAD: 0,
    UNDER_BILLED: 1,
    OVER_BILLED_HIGH: 2,
    OVER_BILLED: 3,
    ON_PACE: 4,
    NO_BUDGET: 5,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return b.estimatedUnderBilledCents - a.estimatedUnderBilledCents;
  });

  const byFlag: Record<BillingPaceFlag, number> = {
    UNDER_BILLED_BAD: 0,
    UNDER_BILLED: 0,
    ON_PACE: 0,
    OVER_BILLED: 0,
    OVER_BILLED_HIGH: 0,
    NO_BUDGET: 0,
  };
  let totalUnderBilledCents = 0;
  for (const r of rows) {
    byFlag[r.flag] += 1;
    if (r.estimatedUnderBilledCents > 0) {
      totalUnderBilledCents += r.estimatedUnderBilledCents;
    }
  }

  return {
    rows,
    rollup: {
      jobs: rows.length,
      totalUnderBilledCents,
      byFlag,
    },
  };
}
