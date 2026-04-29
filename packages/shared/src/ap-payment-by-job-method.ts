// Per (job, AP payment method) rollup.
//
// Plain English: bucket non-voided AP payments by jobId AND
// method (CHECK / ACH / WIRE / CREDIT_CARD / CASH / OTHER).
// Joins payment → AP invoice → jobId. Tells YGE which jobs are
// being paid out by mailed check vs wired vs ACH — useful for
// treasury planning + check-fraud risk.
//
// "Match" = link AP payment → AP invoice by apInvoiceId, then
// take the invoice's jobId (when set).
//
// Per row: jobId, method, total, amountCents, lastPaidOn,
// share (this method's share of the job's total cents).
//
// Sort: jobId asc, amountCents desc within job.
//
// Different from ap-payment-by-job (per-job, byMethod counts
// only — no per-method dollar split or share),
// vendor-payment-method-mix (per vendor, not per job),
// vendor-payment-method-monthly (per month, not per job).
//
// Pure derivation. No persisted records.

import type { ApInvoice, ApPaymentMethod } from './ap-invoice';
import type { ApPayment } from './ap-payment';

export interface ApPaymentByJobMethodRow {
  jobId: string;
  method: ApPaymentMethod;
  total: number;
  amountCents: number;
  lastPaidOn: string | null;
  /** This method's share of the job's total cents, 0..1. */
  share: number;
}

export interface ApPaymentByJobMethodRollup {
  jobsConsidered: number;
  methodsConsidered: number;
  totalPayments: number;
  totalAmountCents: number;
  voidedSkipped: number;
  unattributed: number;
}

export interface ApPaymentByJobMethodInputs {
  apInvoices: ApInvoice[];
  apPayments: ApPayment[];
  /** Optional yyyy-mm-dd window applied to paidOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildApPaymentByJobMethod(
  inputs: ApPaymentByJobMethodInputs,
): {
  rollup: ApPaymentByJobMethodRollup;
  rows: ApPaymentByJobMethodRow[];
} {
  // Index AP invoices by id for fast jobId lookup.
  const invoiceJob = new Map<string, string | undefined>();
  for (const inv of inputs.apInvoices) {
    invoiceJob.set(inv.id, inv.jobId);
  }

  type Acc = {
    jobId: string;
    method: ApPaymentMethod;
    total: number;
    cents: number;
    lastPaidOn: string | null;
  };
  const accs = new Map<string, Acc>();
  const jobTotals = new Map<string, number>();
  const jobs = new Set<string>();
  const methods = new Set<ApPaymentMethod>();

  let voidedSkipped = 0;
  let unattributed = 0;
  let totalPayments = 0;
  let totalAmount = 0;

  const fromD = inputs.fromDate;
  const toD = inputs.toDate;

  for (const p of inputs.apPayments) {
    if (fromD && p.paidOn < fromD) continue;
    if (toD && p.paidOn > toD) continue;
    if (p.voided) {
      voidedSkipped += 1;
      continue;
    }
    const jobId = invoiceJob.get(p.apInvoiceId);
    if (!jobId) {
      unattributed += 1;
      continue;
    }

    const method: ApPaymentMethod = p.method ?? 'CHECK';
    const key = `${jobId}__${method}`;

    let a = accs.get(key);
    if (!a) {
      a = {
        jobId,
        method,
        total: 0,
        cents: 0,
        lastPaidOn: null,
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.cents += p.amountCents;
    if (a.lastPaidOn === null || p.paidOn > a.lastPaidOn) {
      a.lastPaidOn = p.paidOn;
    }

    jobTotals.set(jobId, (jobTotals.get(jobId) ?? 0) + p.amountCents);
    jobs.add(jobId);
    methods.add(method);
    totalPayments += 1;
    totalAmount += p.amountCents;
  }

  const rows: ApPaymentByJobMethodRow[] = [];
  for (const a of accs.values()) {
    const jobTotal = jobTotals.get(a.jobId) ?? 0;
    const share = jobTotal > 0 ? a.cents / jobTotal : 0;
    rows.push({
      jobId: a.jobId,
      method: a.method,
      total: a.total,
      amountCents: a.cents,
      lastPaidOn: a.lastPaidOn,
      share,
    });
  }

  rows.sort((x, y) => {
    if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
    return y.amountCents - x.amountCents;
  });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      methodsConsidered: methods.size,
      totalPayments,
      totalAmountCents: totalAmount,
      voidedSkipped,
      unattributed,
    },
    rows,
  };
}
