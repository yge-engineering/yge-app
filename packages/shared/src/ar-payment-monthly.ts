// AR payment volume by month.
//
// Plain English: bucket AR payments (cash in) by yyyy-mm of
// receivedOn so the bookkeeper sees the cash-in trend by method
// (CHECK / ACH / WIRE / CREDIT_CARD / CASH / OTHER) and kind
// (PROGRESS / RETENTION / CHANGE_ORDER / DEPOSIT / OTHER).
//
// Per row: month, total, totalAmountCents, distinctCustomers,
// distinctJobs, byMethod, byKind.
//
// Sort by month asc.
//
// Different from monthly-billing (invoices, not receipts),
// monthly-cash-net (in vs out combined), customer-payment-
// velocity (per-customer timing).
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentKind, ArPaymentMethod } from './ar-payment';

export interface ArPaymentMonthlyRow {
  month: string;
  total: number;
  totalAmountCents: number;
  distinctCustomers: number;
  distinctJobs: number;
  byMethod: Partial<Record<ArPaymentMethod, number>>;
  byKind: Partial<Record<ArPaymentKind, number>>;
}

export interface ArPaymentMonthlyRollup {
  monthsConsidered: number;
  totalPayments: number;
  totalAmountCents: number;
  monthOverMonthAmountChange: number;
}

export interface ArPaymentMonthlyInputs {
  arPayments: ArPayment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildArPaymentMonthly(
  inputs: ArPaymentMonthlyInputs,
): {
  rollup: ArPaymentMonthlyRollup;
  rows: ArPaymentMonthlyRow[];
} {
  type Bucket = {
    month: string;
    total: number;
    amount: number;
    customers: Set<string>;
    jobs: Set<string>;
    byMethod: Map<ArPaymentMethod, number>;
    byKind: Map<ArPaymentKind, number>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    total: 0,
    amount: 0,
    customers: new Set<string>(),
    jobs: new Set<string>(),
    byMethod: new Map<ArPaymentMethod, number>(),
    byKind: new Map<ArPaymentKind, number>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const p of inputs.arPayments) {
    const month = p.receivedOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.total += 1;
    b.amount += p.amountCents;
    if (p.payerName) b.customers.add(canonicalize(p.payerName));
    if (p.jobId) b.jobs.add(p.jobId);
    b.byMethod.set(p.method, (b.byMethod.get(p.method) ?? 0) + 1);
    b.byKind.set(p.kind, (b.byKind.get(p.kind) ?? 0) + 1);
    buckets.set(month, b);
  }

  const rows: ArPaymentMonthlyRow[] = Array.from(buckets.values())
    .map((b) => {
      const methodObj: Partial<Record<ArPaymentMethod, number>> = {};
      for (const [k, v] of b.byMethod.entries()) methodObj[k] = v;
      const kindObj: Partial<Record<ArPaymentKind, number>> = {};
      for (const [k, v] of b.byKind.entries()) kindObj[k] = v;
      return {
        month: b.month,
        total: b.total,
        totalAmountCents: b.amount,
        distinctCustomers: b.customers.size,
        distinctJobs: b.jobs.size,
        byMethod: methodObj,
        byKind: kindObj,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.totalAmountCents - prev.totalAmountCents;
  }

  let totalPayments = 0;
  let totalAmount = 0;
  for (const r of rows) {
    totalPayments += r.total;
    totalAmount += r.totalAmountCents;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalPayments,
      totalAmountCents: totalAmount,
      monthOverMonthAmountChange: mom,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|department|dept|of)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
