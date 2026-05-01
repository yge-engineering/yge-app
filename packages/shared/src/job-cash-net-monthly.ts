// Per (job, month) cash net.
//
// Plain English: per job, per month — AR receipts (in) minus AP
// payments (out, joined via AP invoice → job). Long-format. The
// per-job cash trajectory.
//
// Per row: jobId, month, receiptsCents, paymentsCents, netCents.
//
// Sort: jobId asc, month asc.
//
// Different from monthly-cash-net (portfolio per month, no job
// axis), daily-cash-net (per-day portfolio).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

export interface JobCashNetMonthlyRow {
  jobId: string;
  month: string;
  receiptsCents: number;
  paymentsCents: number;
  netCents: number;
}

export interface JobCashNetMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  receiptsCents: number;
  paymentsCents: number;
  netCents: number;
}

export interface JobCashNetMonthlyInputs {
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobCashNetMonthly(
  inputs: JobCashNetMonthlyInputs,
): {
  rollup: JobCashNetMonthlyRollup;
  rows: JobCashNetMonthlyRow[];
} {
  const jobByInvoice = new Map<string, string>();
  for (const inv of inputs.apInvoices) {
    if (inv.jobId) jobByInvoice.set(inv.id, inv.jobId);
  }

  type Acc = {
    jobId: string;
    month: string;
    receipts: number;
    payments: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();

  const accFor = (jobId: string, month: string): Acc => {
    const key = `${jobId}|${month}`;
    let acc = accs.get(key);
    if (!acc) {
      acc = { jobId, month, receipts: 0, payments: 0 };
      accs.set(key, acc);
    }
    jobSet.add(jobId);
    monthSet.add(month);
    return acc;
  };

  for (const p of inputs.arPayments) {
    if (!p.jobId) continue;
    const month = p.receivedOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    accFor(p.jobId, month).receipts += p.amountCents;
  }

  for (const p of inputs.apPayments) {
    if (p.voided) continue;
    const jobId = jobByInvoice.get(p.apInvoiceId);
    if (!jobId) continue;
    const month = p.paidOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    accFor(jobId, month).payments += p.amountCents;
  }

  const rows: JobCashNetMonthlyRow[] = [];
  let totalReceipts = 0;
  let totalPayments = 0;
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      receiptsCents: acc.receipts,
      paymentsCents: acc.payments,
      netCents: acc.receipts - acc.payments,
    });
    totalReceipts += acc.receipts;
    totalPayments += acc.payments;
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      monthsConsidered: monthSet.size,
      receiptsCents: totalReceipts,
      paymentsCents: totalPayments,
      netCents: totalReceipts - totalPayments,
    },
    rows,
  };
}
