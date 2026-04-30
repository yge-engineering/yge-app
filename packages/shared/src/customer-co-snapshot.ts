// Customer-anchored change-order snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count COs across all their jobs, status + reason
// mix, total amount cents, separate approved+executed amount
// from proposed amount, distinct jobs. Drives the right-now
// per-customer change-order overview.
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderReason, ChangeOrderStatus } from './change-order';
import type { Job } from './job';

export interface CustomerCoSnapshotResult {
  asOf: string;
  customerName: string;
  totalCos: number;
  byStatus: Partial<Record<ChangeOrderStatus, number>>;
  byReason: Partial<Record<ChangeOrderReason, number>>;
  totalAmountCents: number;
  approvedOrExecutedAmountCents: number;
  proposedAmountCents: number;
  distinctJobs: number;
}

export interface CustomerCoSnapshotInputs {
  customerName: string;
  changeOrders: ChangeOrder[];
  jobs: Job[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function sumAmount(co: ChangeOrder): number {
  let total = 0;
  for (const item of co.lineItems ?? []) total += item.amountCents ?? 0;
  return total;
}

export function buildCustomerCoSnapshot(
  inputs: CustomerCoSnapshotInputs,
): CustomerCoSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const jobIdsForCustomer = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) jobIdsForCustomer.add(j.id);
  }

  const byStatus = new Map<ChangeOrderStatus, number>();
  const byReason = new Map<ChangeOrderReason, number>();
  const jobs = new Set<string>();

  let totalCos = 0;
  let totalAmountCents = 0;
  let approvedOrExecutedAmountCents = 0;
  let proposedAmountCents = 0;

  for (const co of inputs.changeOrders) {
    if (!jobIdsForCustomer.has(co.jobId)) continue;
    totalCos += 1;
    const status: ChangeOrderStatus = co.status ?? 'PROPOSED';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byReason.set(co.reason, (byReason.get(co.reason) ?? 0) + 1);
    const amount = sumAmount(co);
    totalAmountCents += amount;
    if (status === 'APPROVED' || status === 'EXECUTED') approvedOrExecutedAmountCents += amount;
    else if (status === 'PROPOSED') proposedAmountCents += amount;
    jobs.add(co.jobId);
  }

  const sOut: Partial<Record<ChangeOrderStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;
  const rOut: Partial<Record<ChangeOrderReason, number>> = {};
  for (const [k, v] of byReason) rOut[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalCos,
    byStatus: sOut,
    byReason: rOut,
    totalAmountCents,
    approvedOrExecutedAmountCents,
    proposedAmountCents,
    distinctJobs: jobs.size,
  };
}
