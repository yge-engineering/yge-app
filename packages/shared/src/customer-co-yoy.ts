// Customer-anchored change-order year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of CO records into a comparison: counts,
// status mix, total amount cents, approved+executed amount,
// proposed amount, distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderStatus } from './change-order';
import type { Job } from './job';

export interface CustomerCoYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByStatus: Partial<Record<ChangeOrderStatus, number>>;
  priorTotalAmountCents: number;
  priorApprovedOrExecutedCents: number;
  priorProposedCents: number;
  priorDistinctJobs: number;
  currentTotal: number;
  currentByStatus: Partial<Record<ChangeOrderStatus, number>>;
  currentTotalAmountCents: number;
  currentApprovedOrExecutedCents: number;
  currentProposedCents: number;
  currentDistinctJobs: number;
  totalDelta: number;
  totalAmountDelta: number;
}

export interface CustomerCoYoyInputs {
  customerName: string;
  changeOrders: ChangeOrder[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function sumAmount(co: ChangeOrder): number {
  let total = 0;
  for (const item of co.lineItems ?? []) total += item.amountCents ?? 0;
  return total;
}

export function buildCustomerCoYoy(
  inputs: CustomerCoYoyInputs,
): CustomerCoYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    total: number;
    byStatus: Map<ChangeOrderStatus, number>;
    amount: number;
    approvedOrExecuted: number;
    proposed: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      byStatus: new Map(),
      amount: 0,
      approvedOrExecuted: 0,
      proposed: 0,
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const co of inputs.changeOrders) {
    if (!customerJobs.has(co.jobId)) continue;
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
    b.jobs.add(co.jobId);
  }

  function statusRecord(m: Map<ChangeOrderStatus, number>): Partial<Record<ChangeOrderStatus, number>> {
    const out: Partial<Record<ChangeOrderStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByStatus: statusRecord(prior.byStatus),
    priorTotalAmountCents: prior.amount,
    priorApprovedOrExecutedCents: prior.approvedOrExecuted,
    priorProposedCents: prior.proposed,
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentByStatus: statusRecord(current.byStatus),
    currentTotalAmountCents: current.amount,
    currentApprovedOrExecutedCents: current.approvedOrExecuted,
    currentProposedCents: current.proposed,
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
    totalAmountDelta: current.amount - prior.amount,
  };
}
