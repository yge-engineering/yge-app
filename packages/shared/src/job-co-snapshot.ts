// Job-anchored change-order snapshot.
//
// Plain English: for one job, as-of today, count COs by status
// + reason, sum total amount cents, separate approved+executed
// amount from proposed amount, count distinct subjects. Drives
// the right-now per-job change-order overview.
//
// Pure derivation. No persisted records.

import type {
  ChangeOrder,
  ChangeOrderReason,
  ChangeOrderStatus,
} from './change-order';

export interface JobCoSnapshotResult {
  asOf: string;
  jobId: string;
  totalCos: number;
  byStatus: Partial<Record<ChangeOrderStatus, number>>;
  byReason: Partial<Record<ChangeOrderReason, number>>;
  totalAmountCents: number;
  approvedOrExecutedAmountCents: number;
  proposedAmountCents: number;
  distinctSubjects: number;
}

export interface JobCoSnapshotInputs {
  jobId: string;
  changeOrders: ChangeOrder[];
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

function sumAmount(co: ChangeOrder): number {
  let total = 0;
  for (const item of co.lineItems ?? []) total += item.amountCents ?? 0;
  return total;
}

export function buildJobCoSnapshot(
  inputs: JobCoSnapshotInputs,
): JobCoSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byStatus = new Map<ChangeOrderStatus, number>();
  const byReason = new Map<ChangeOrderReason, number>();
  const subjects = new Set<string>();

  let totalCos = 0;
  let totalAmountCents = 0;
  let approvedOrExecutedAmountCents = 0;
  let proposedAmountCents = 0;

  for (const co of inputs.changeOrders) {
    if (co.jobId !== inputs.jobId) continue;
    totalCos += 1;
    const status: ChangeOrderStatus = co.status ?? 'PROPOSED';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byReason.set(co.reason, (byReason.get(co.reason) ?? 0) + 1);
    const amount = sumAmount(co);
    totalAmountCents += amount;
    if (status === 'APPROVED' || status === 'EXECUTED') {
      approvedOrExecutedAmountCents += amount;
    } else if (status === 'PROPOSED') {
      proposedAmountCents += amount;
    }
    if (co.subject) subjects.add(co.subject.trim().toLowerCase());
  }

  const sOut: Partial<Record<ChangeOrderStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;
  const rOut: Partial<Record<ChangeOrderReason, number>> = {};
  for (const [k, v] of byReason) rOut[k] = v;

  return {
    asOf,
    jobId: inputs.jobId,
    totalCos,
    byStatus: sOut,
    byReason: rOut,
    totalAmountCents,
    approvedOrExecutedAmountCents,
    proposedAmountCents,
    distinctSubjects: subjects.size,
  };
}
