// Job-anchored cash net snapshot.
//
// Plain English: for one job, as-of today, sum AR receipts
// (cash in) minus AP disbursements (cash out, ex voided).
// Drives the right-now per-job net-cash overview.
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

export interface JobCashNetSnapshotResult {
  asOf: string;
  jobId: string;
  totalReceiptsCents: number;
  totalDisbursementsCents: number;
  netCents: number;
  receiptCount: number;
  disbursementCount: number;
}

export interface JobCashNetSnapshotInputs {
  jobId: string;
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  /** Mapping AP invoice id → job id (so AP payments tagged via their
   *  invoice can roll up here). Optional; falls back to comparing the
   *  AP payment's apInvoiceId to a string equal to the jobId, which
   *  almost never matches. */
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

export function buildJobCashNetSnapshot(
  inputs: JobCashNetSnapshotInputs,
): JobCashNetSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const apMap = inputs.apInvoiceJobByInvoiceId ?? {};

  let totalReceiptsCents = 0;
  let receiptCount = 0;
  for (const p of inputs.arPayments) {
    if (p.jobId !== inputs.jobId) continue;
    if (p.receivedOn > asOf) continue;
    totalReceiptsCents += p.amountCents;
    receiptCount += 1;
  }

  let totalDisbursementsCents = 0;
  let disbursementCount = 0;
  for (const p of inputs.apPayments) {
    if (p.paidOn > asOf) continue;
    if (p.voided) continue;
    const apJobId = apMap[p.apInvoiceId];
    if (apJobId !== inputs.jobId) continue;
    totalDisbursementsCents += p.amountCents;
    disbursementCount += 1;
  }

  return {
    asOf,
    jobId: inputs.jobId,
    totalReceiptsCents,
    totalDisbursementsCents,
    netCents: totalReceiptsCents - totalDisbursementsCents,
    receiptCount,
    disbursementCount,
  };
}
