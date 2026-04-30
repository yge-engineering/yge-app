// Job-anchored change-order year-over-year.
//
// Plain English: for one job, collapse two years of CO records
// into a comparison: counts, status mix, total amount cents,
// approved+executed amount, proposed amount, plus deltas.
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderStatus } from './change-order';

export interface JobCoYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByStatus: Partial<Record<ChangeOrderStatus, number>>;
  priorAmountCents: number;
  priorApprovedOrExecutedCents: number;
  priorProposedCents: number;
  currentTotal: number;
  currentByStatus: Partial<Record<ChangeOrderStatus, number>>;
  currentAmountCents: number;
  currentApprovedOrExecutedCents: number;
  currentProposedCents: number;
  totalDelta: number;
  amountDelta: number;
}

export interface JobCoYoyInputs {
  jobId: string;
  changeOrders: ChangeOrder[];
  currentYear: number;
}

function sumAmount(co: ChangeOrder): number {
  let total = 0;
  for (const item of co.lineItems ?? []) total += item.amountCents ?? 0;
  return total;
}

export function buildJobCoYoy(inputs: JobCoYoyInputs): JobCoYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    byStatus: Map<ChangeOrderStatus, number>;
    amount: number;
    approvedOrExecuted: number;
    proposed: number;
  };
  function emptyBucket(): Bucket {
    return { total: 0, byStatus: new Map(), amount: 0, approvedOrExecuted: 0, proposed: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const co of inputs.changeOrders) {
    if (co.jobId !== inputs.jobId) continue;
    const dt = co.proposedAt;
    if (!dt) continue;
    const year = Number(dt.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const status: ChangeOrderStatus = co.status ?? 'PROPOSED';
    b.byStatus.set(status, (b.byStatus.get(status) ?? 0) + 1);
    const amount = sumAmount(co);
    b.amount += amount;
    if (status === 'APPROVED' || status === 'EXECUTED') b.approvedOrExecuted += amount;
    else if (status === 'PROPOSED') b.proposed += amount;
  }

  function statusRecord(m: Map<ChangeOrderStatus, number>): Partial<Record<ChangeOrderStatus, number>> {
    const out: Partial<Record<ChangeOrderStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByStatus: statusRecord(prior.byStatus),
    priorAmountCents: prior.amount,
    priorApprovedOrExecutedCents: prior.approvedOrExecuted,
    priorProposedCents: prior.proposed,
    currentTotal: current.total,
    currentByStatus: statusRecord(current.byStatus),
    currentAmountCents: current.amount,
    currentApprovedOrExecutedCents: current.approvedOrExecuted,
    currentProposedCents: current.proposed,
    totalDelta: current.total - prior.total,
    amountDelta: current.amount - prior.amount,
  };
}
