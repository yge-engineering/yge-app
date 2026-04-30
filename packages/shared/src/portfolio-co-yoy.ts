// Portfolio change-order year-over-year.
//
// Plain English: collapse two years of change orders into a
// single comparison row. Sized for the executive change-order
// trend conversation.
//
// Different from portfolio-co-monthly (per month).
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderReason } from './change-order';

export interface PortfolioCoYoyResult {
  priorYear: number;
  currentYear: number;
  priorProposedCount: number;
  priorApprovedCount: number;
  priorExecutedCount: number;
  priorTotalAmountCents: number;
  priorByReason: Partial<Record<ChangeOrderReason, number>>;
  priorDistinctJobs: number;
  currentProposedCount: number;
  currentApprovedCount: number;
  currentExecutedCount: number;
  currentTotalAmountCents: number;
  currentByReason: Partial<Record<ChangeOrderReason, number>>;
  currentDistinctJobs: number;
  proposedCountDelta: number;
  totalAmountCentsDelta: number;
}

export interface PortfolioCoYoyInputs {
  changeOrders: ChangeOrder[];
  currentYear: number;
}

function sumAmount(co: ChangeOrder): number {
  let total = 0;
  for (const item of co.lineItems ?? []) total += item.amountCents ?? 0;
  return total;
}

export function buildPortfolioCoYoy(
  inputs: PortfolioCoYoyInputs,
): PortfolioCoYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    proposedCount: number;
    approvedCount: number;
    executedCount: number;
    totalAmountCents: number;
    byReason: Map<ChangeOrderReason, number>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      proposedCount: 0,
      approvedCount: 0,
      executedCount: 0,
      totalAmountCents: 0,
      byReason: new Map(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const co of inputs.changeOrders) {
    if (!co.proposedAt) continue;
    const year = Number(co.proposedAt.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.proposedCount += 1;
    if (co.approvedAt) b.approvedCount += 1;
    if (co.executedAt) b.executedCount += 1;
    b.totalAmountCents += sumAmount(co);
    b.byReason.set(co.reason, (b.byReason.get(co.reason) ?? 0) + 1);
    b.jobs.add(co.jobId);
  }

  function toRecord(m: Map<ChangeOrderReason, number>): Partial<Record<ChangeOrderReason, number>> {
    const out: Partial<Record<ChangeOrderReason, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorProposedCount: prior.proposedCount,
    priorApprovedCount: prior.approvedCount,
    priorExecutedCount: prior.executedCount,
    priorTotalAmountCents: prior.totalAmountCents,
    priorByReason: toRecord(prior.byReason),
    priorDistinctJobs: prior.jobs.size,
    currentProposedCount: current.proposedCount,
    currentApprovedCount: current.approvedCount,
    currentExecutedCount: current.executedCount,
    currentTotalAmountCents: current.totalAmountCents,
    currentByReason: toRecord(current.byReason),
    currentDistinctJobs: current.jobs.size,
    proposedCountDelta: current.proposedCount - prior.proposedCount,
    totalAmountCentsDelta: current.totalAmountCents - prior.totalAmountCents,
  };
}
