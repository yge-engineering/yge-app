// Customer-anchored per-job cash-net detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, return one row per job with that job's AR
// receipts cents minus AP disbursements cents (ex voided), plus
// net. Sorted by net descending so the biggest winners come
// first.
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

export interface CustomerCashNetDetailRow {
  jobId: string;
  receiptsCents: number;
  disbursementsCents: number;
  netCents: number;
}

export interface CustomerCashNetDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerCashNetDetailRow[];
}

export interface CustomerCashNetDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  apInvoiceJobByInvoiceId?: Record<string, string>;
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

export function buildCustomerCashNetDetailSnapshot(
  inputs: CustomerCashNetDetailSnapshotInputs,
): CustomerCashNetDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);
  const apMap = inputs.apInvoiceJobByInvoiceId ?? {};

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = { receipts: number; disbursements: number };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { receipts: 0, disbursements: 0 };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const p of inputs.arPayments) {
    if (p.receivedOn > asOf) continue;
    if (!customerJobs.has(p.jobId)) continue;
    getAcc(p.jobId).receipts += p.amountCents;
  }
  for (const p of inputs.apPayments) {
    if (p.paidOn > asOf) continue;
    if (p.voided) continue;
    const apJobId = apMap[p.apInvoiceId];
    if (apJobId == null || !customerJobs.has(apJobId)) continue;
    getAcc(apJobId).disbursements += p.amountCents;
  }

  const rows: CustomerCashNetDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      receiptsCents: a.receipts,
      disbursementsCents: a.disbursements,
      netCents: a.receipts - a.disbursements,
    }))
    .sort((a, b) => b.netCents - a.netCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
