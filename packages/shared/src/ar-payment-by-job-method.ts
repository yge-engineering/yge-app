// Per (job, AR payment method) rollup.
//
// Plain English: bucket AR payments by jobId AND method
// (CHECK / ACH / WIRE / CARD / CASH / OTHER). Tells the
// bookkeeper which jobs settle by mailed check vs wired vs ACH —
// useful when YGE wants to push a particular customer/job off
// paper checks and onto faster channels.
//
// Per row: jobId, method, total, amountCents, lastReceivedOn,
// share (this method's share of the job's total cents).
//
// Sort: jobId asc, amountCents desc within job.
//
// Different from ar-payment-by-job (per-job, kind mix only),
// customer-payment-method-mix (per customer, not per job),
// customer-payment-method-monthly (per month, not per job).
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentMethod } from './ar-payment';

export interface ArPaymentByJobMethodRow {
  jobId: string;
  method: ArPaymentMethod;
  total: number;
  amountCents: number;
  lastReceivedOn: string | null;
  /** This method's share of the job's total cents, 0..1. */
  share: number;
}

export interface ArPaymentByJobMethodRollup {
  jobsConsidered: number;
  methodsConsidered: number;
  totalPayments: number;
  totalAmountCents: number;
  unattributed: number;
}

export interface ArPaymentByJobMethodInputs {
  arPayments: ArPayment[];
  /** Optional yyyy-mm-dd window applied to receivedOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildArPaymentByJobMethod(
  inputs: ArPaymentByJobMethodInputs,
): {
  rollup: ArPaymentByJobMethodRollup;
  rows: ArPaymentByJobMethodRow[];
} {
  type Acc = {
    jobId: string;
    method: ArPaymentMethod;
    total: number;
    cents: number;
    lastReceivedOn: string | null;
  };
  const accs = new Map<string, Acc>();
  const jobTotals = new Map<string, number>();
  const jobs = new Set<string>();
  const methods = new Set<ArPaymentMethod>();

  let unattributed = 0;
  let totalPayments = 0;
  let totalAmount = 0;

  const fromD = inputs.fromDate;
  const toD = inputs.toDate;

  for (const p of inputs.arPayments) {
    if (fromD && p.receivedOn < fromD) continue;
    if (toD && p.receivedOn > toD) continue;
    if (!p.jobId) {
      unattributed += 1;
      continue;
    }

    const method: ArPaymentMethod = p.method ?? 'CHECK';
    const key = `${p.jobId}__${method}`;

    let a = accs.get(key);
    if (!a) {
      a = {
        jobId: p.jobId,
        method,
        total: 0,
        cents: 0,
        lastReceivedOn: null,
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.cents += p.amountCents;
    if (a.lastReceivedOn === null || p.receivedOn > a.lastReceivedOn) {
      a.lastReceivedOn = p.receivedOn;
    }

    jobTotals.set(p.jobId, (jobTotals.get(p.jobId) ?? 0) + p.amountCents);
    jobs.add(p.jobId);
    methods.add(method);
    totalPayments += 1;
    totalAmount += p.amountCents;
  }

  const rows: ArPaymentByJobMethodRow[] = [];
  for (const a of accs.values()) {
    const jobTotal = jobTotals.get(a.jobId) ?? 0;
    const share = jobTotal > 0 ? a.cents / jobTotal : 0;
    rows.push({
      jobId: a.jobId,
      method: a.method,
      total: a.total,
      amountCents: a.cents,
      lastReceivedOn: a.lastReceivedOn,
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
      unattributed,
    },
    rows,
  };
}
