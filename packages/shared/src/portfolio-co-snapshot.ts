// Portfolio change-order snapshot (point-in-time).
//
// Plain English: as-of today, count change orders by status
// (PROPOSED / APPROVED / EXECUTED / REJECTED / WITHDRAWN),
// total amount cents, byReason mix, distinct jobs.
//
// Pure derivation. No persisted records.

import type {
  ChangeOrder,
  ChangeOrderReason,
  ChangeOrderStatus,
} from './change-order';

export interface PortfolioCoSnapshotResult {
  totalCos: number;
  byStatus: Partial<Record<ChangeOrderStatus, number>>;
  byReason: Partial<Record<ChangeOrderReason, number>>;
  totalAmountCents: number;
  distinctJobs: number;
}

export interface PortfolioCoSnapshotInputs {
  changeOrders: ChangeOrder[];
}

function sumAmount(co: ChangeOrder): number {
  let total = 0;
  for (const item of co.lineItems ?? []) total += item.amountCents ?? 0;
  return total;
}

export function buildPortfolioCoSnapshot(
  inputs: PortfolioCoSnapshotInputs,
): PortfolioCoSnapshotResult {
  const byStatus = new Map<ChangeOrderStatus, number>();
  const byReason = new Map<ChangeOrderReason, number>();
  let totalAmountCents = 0;
  const jobs = new Set<string>();

  for (const co of inputs.changeOrders) {
    const status: ChangeOrderStatus = co.status ?? 'PROPOSED';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byReason.set(co.reason, (byReason.get(co.reason) ?? 0) + 1);
    totalAmountCents += sumAmount(co);
    jobs.add(co.jobId);
  }

  function statusRecord(m: Map<ChangeOrderStatus, number>): Partial<Record<ChangeOrderStatus, number>> {
    const out: Partial<Record<ChangeOrderStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function reasonRecord(m: Map<ChangeOrderReason, number>): Partial<Record<ChangeOrderReason, number>> {
    const out: Partial<Record<ChangeOrderReason, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    totalCos: inputs.changeOrders.length,
    byStatus: statusRecord(byStatus),
    byReason: reasonRecord(byReason),
    totalAmountCents,
    distinctJobs: jobs.size,
  };
}
