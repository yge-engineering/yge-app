// WIP — Work-in-Progress (job cost summary) report.
//
// The WIP report is the standard surety / banker / CPA snapshot of
// every active job: how much you're contracted for, how much you've
// billed and collected, how much it's actually costing, and whether
// you're over- or under-billed against percent complete.
//
// Bonding companies reissue every quarter and lean on it heavily for
// single-job + aggregate working-capital ratios. CPAs use it for
// percentage-of-completion revenue recognition on the year-end
// financial statements.
//
// This module is a pure derivation — it rolls up the AR invoices, AR
// payments, AP invoices, and (eventually) labor + equipment cost
// already in the system into the WIP shape per job.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { ChangeOrder } from './change-order';
import type { Job } from './job';

export interface WipRow {
  jobId: string;
  projectName: string;
  status: Job['status'];

  /** Original contract value (cents). Pulled from the awarded
   *  priced-estimate total or job's engineer's estimate as fallback. */
  originalContractCents: number;
  /** Approved CO total (cents). Sum of executed change orders. */
  changeOrderTotalCents: number;
  /** Adjusted contract = original + COs (cents). */
  adjustedContractCents: number;

  /** Estimated cost at completion (cents). For Phase 1 this is the
   *  caller-supplied budget; future phases derive from priced
   *  estimate. */
  estimatedCostAtCompletionCents: number;
  /** Estimated gross profit at completion = adjusted contract -
   *  estimated cost at completion (cents). */
  estimatedGrossProfitCents: number;

  /** Costs incurred to date — AP invoices (job-coded) + labor +
   *  equipment. (Phase 1: AP invoices only.) (cents) */
  costsIncurredCents: number;

  /** % complete based on cost — costsIncurred / estimatedCostAtCompletion.
   *  Capped at 100. Returns 0 when the denominator is missing. */
  percentComplete: number;

  /** Earned revenue = adjustedContract * percentComplete. (cents) */
  earnedRevenueCents: number;

  /** Total billed to date — sum of AR invoices for this job. (cents) */
  billedToDateCents: number;
  /** Cash collected — sum of AR payments for this job. (cents) */
  collectedToDateCents: number;
  /** Retention held = billed - collected - non-retention payments. */
  retentionHeldCents: number;

  /** Over/under billing.
   *  Positive = over-billed (billed > earned, deferred income). Negative
   *  = under-billed (earned > billed, costs in excess of billings). */
  overBilledCents: number;
  underBilledCents: number;
}

export interface WipInputs {
  job: Pick<Job, 'id' | 'projectName' | 'status'>;
  /** Original contract value, cents. Caller supplies this from the
   *  awarded estimate. */
  originalContractCents: number;
  /** Estimated cost at completion, cents. Caller supplies from the
   *  awarded estimate's cost basis. */
  estimatedCostAtCompletionCents: number;

  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  apInvoices: ApInvoice[];
  changeOrders: ChangeOrder[];
}

/**
 * Compute the WIP row for a single job from already-loaded source
 * records. Caller pre-filters arInvoices/arPayments/apInvoices/COs
 * by jobId.
 */
export function buildWipRow(inputs: WipInputs): WipRow {
  const {
    job,
    originalContractCents,
    estimatedCostAtCompletionCents,
    arInvoices,
    arPayments,
    apInvoices,
    changeOrders,
  } = inputs;

  // CO total — only count APPROVED + EXECUTED change orders.
  let changeOrderTotalCents = 0;
  for (const co of changeOrders) {
    if (co.status === 'APPROVED' || co.status === 'EXECUTED') {
      changeOrderTotalCents += co.amountCents;
    }
  }

  const adjustedContractCents = originalContractCents + changeOrderTotalCents;
  const estimatedGrossProfitCents = adjustedContractCents - estimatedCostAtCompletionCents;

  // Costs incurred — Phase 1: AP invoices in approved/paid status that
  // are coded to this job. Skip drafts, voided, on-hold.
  let costsIncurredCents = 0;
  for (const ap of apInvoices) {
    if (
      ap.status === 'APPROVED' ||
      ap.status === 'PAID' ||
      ap.status === 'PARTIALLY_PAID'
    ) {
      costsIncurredCents += ap.totalCents;
    }
  }

  const percentComplete =
    estimatedCostAtCompletionCents > 0
      ? Math.min(1, costsIncurredCents / estimatedCostAtCompletionCents)
      : 0;

  const earnedRevenueCents = Math.round(adjustedContractCents * percentComplete);

  // Billed = sum of AR invoice totals (already includes retention as a
  // deduction in totalCents).
  let billedToDateCents = 0;
  for (const inv of arInvoices) {
    billedToDateCents += inv.totalCents;
  }

  // Collected = sum of all AR payments for this job.
  let collectedToDateCents = 0;
  let retentionReleasedCents = 0;
  for (const p of arPayments) {
    collectedToDateCents += p.amountCents;
    if (p.kind === 'RETENTION_RELEASE') retentionReleasedCents += p.amountCents;
  }

  // Retention held = sum of explicit retention deductions per AR
  // invoice, less retention payments already released.
  let totalRetentionInvoicedCents = 0;
  for (const inv of arInvoices) {
    totalRetentionInvoicedCents += inv.retentionCents ?? 0;
  }
  const retentionHeldCents = Math.max(
    0,
    totalRetentionInvoicedCents - retentionReleasedCents,
  );

  const delta = billedToDateCents - earnedRevenueCents;
  const overBilledCents = delta > 0 ? delta : 0;
  const underBilledCents = delta < 0 ? -delta : 0;

  return {
    jobId: job.id,
    projectName: job.projectName,
    status: job.status,
    originalContractCents,
    changeOrderTotalCents,
    adjustedContractCents,
    estimatedCostAtCompletionCents,
    estimatedGrossProfitCents,
    costsIncurredCents,
    percentComplete,
    earnedRevenueCents,
    billedToDateCents,
    collectedToDateCents,
    retentionHeldCents,
    overBilledCents,
    underBilledCents,
  };
}

export interface WipRollup {
  jobs: number;
  totalAdjustedContractCents: number;
  totalEstimatedGrossProfitCents: number;
  totalCostsIncurredCents: number;
  totalEarnedRevenueCents: number;
  totalBilledCents: number;
  totalCollectedCents: number;
  totalRetentionHeldCents: number;
  totalOverBilledCents: number;
  totalUnderBilledCents: number;
}

export function computeWipRollup(rows: WipRow[]): WipRollup {
  let totalAdjustedContractCents = 0;
  let totalEstimatedGrossProfitCents = 0;
  let totalCostsIncurredCents = 0;
  let totalEarnedRevenueCents = 0;
  let totalBilledCents = 0;
  let totalCollectedCents = 0;
  let totalRetentionHeldCents = 0;
  let totalOverBilledCents = 0;
  let totalUnderBilledCents = 0;
  for (const r of rows) {
    totalAdjustedContractCents += r.adjustedContractCents;
    totalEstimatedGrossProfitCents += r.estimatedGrossProfitCents;
    totalCostsIncurredCents += r.costsIncurredCents;
    totalEarnedRevenueCents += r.earnedRevenueCents;
    totalBilledCents += r.billedToDateCents;
    totalCollectedCents += r.collectedToDateCents;
    totalRetentionHeldCents += r.retentionHeldCents;
    totalOverBilledCents += r.overBilledCents;
    totalUnderBilledCents += r.underBilledCents;
  }
  return {
    jobs: rows.length,
    totalAdjustedContractCents,
    totalEstimatedGrossProfitCents,
    totalCostsIncurredCents,
    totalEarnedRevenueCents,
    totalBilledCents,
    totalCollectedCents,
    totalRetentionHeldCents,
    totalOverBilledCents,
    totalUnderBilledCents,
  };
}
