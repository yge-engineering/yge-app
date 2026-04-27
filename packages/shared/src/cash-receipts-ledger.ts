// Daily cash receipts ledger.
//
// Plain English: each day in window, what came in? AR payments
// grouped by receivedOn date give the deposit-side picture — the
// $$$ that hit the bank account each day. Drives:
//   - daily cash visibility ("Tuesday was a $90K day")
//   - retention release tracking (separate from progress payments)
//   - bank reconciliation prep (totals match the deposit slip)
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentKind } from './ar-payment';

export interface CashReceiptsRow {
  date: string;
  paymentCount: number;
  totalCents: number;
  /** Per payment-kind breakdown. */
  byKind: Record<ArPaymentKind, number>;
  distinctCustomers: number;
  distinctJobs: number;
}

export interface CashReceiptsRollup {
  daysWithReceipts: number;
  totalCents: number;
  totalByKind: Record<ArPaymentKind, number>;
  /** Highest single-day receipts. */
  peakDayCents: number;
  peakDayDate: string | null;
  /** Avg receipts per day with activity. */
  avgPerActiveDayCents: number;
}

export interface CashReceiptsInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  arPayments: ArPayment[];
  /** Optional invoice → customerName lookup so distinctCustomers
   *  per day reflects real names (otherwise distinctCustomers is
   *  derived from arInvoiceId which is a less-useful proxy). */
  customerNameByInvoiceId?: Map<string, string>;
}

const KIND_KEYS: ArPaymentKind[] = [
  'PROGRESS',
  'RETENTION_RELEASE',
  'FINAL',
  'PARTIAL',
  'OTHER',
];

export function buildCashReceiptsLedger(
  inputs: CashReceiptsInputs,
): {
  rollup: CashReceiptsRollup;
  rows: CashReceiptsRow[];
} {
  type Bucket = {
    date: string;
    paymentCount: number;
    total: number;
    byKind: Record<ArPaymentKind, number>;
    customerKeys: Set<string>;
    jobs: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const p of inputs.arPayments) {
    if (p.receivedOn < inputs.fromDate) continue;
    if (p.receivedOn > inputs.toDate) continue;
    const b = buckets.get(p.receivedOn) ?? {
      date: p.receivedOn,
      paymentCount: 0,
      total: 0,
      byKind: emptyKindRecord(),
      customerKeys: new Set<string>(),
      jobs: new Set<string>(),
    };
    b.paymentCount += 1;
    b.total += p.amountCents;
    b.byKind[p.kind] += p.amountCents;
    b.jobs.add(p.jobId);
    const customerKey =
      inputs.customerNameByInvoiceId?.get(p.arInvoiceId) ?? p.arInvoiceId;
    b.customerKeys.add(customerKey);
    buckets.set(p.receivedOn, b);
  }

  const rows: CashReceiptsRow[] = [];
  const grandByKind = emptyKindRecord();
  let grandTotal = 0;
  let peakCents = 0;
  let peakDate: string | null = null;

  for (const b of buckets.values()) {
    rows.push({
      date: b.date,
      paymentCount: b.paymentCount,
      totalCents: b.total,
      byKind: { ...b.byKind },
      distinctCustomers: b.customerKeys.size,
      distinctJobs: b.jobs.size,
    });
    grandTotal += b.total;
    for (const k of KIND_KEYS) grandByKind[k] += b.byKind[k];
    if (b.total > peakCents) {
      peakCents = b.total;
      peakDate = b.date;
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    rollup: {
      daysWithReceipts: rows.length,
      totalCents: grandTotal,
      totalByKind: grandByKind,
      peakDayCents: peakCents,
      peakDayDate: peakDate,
      avgPerActiveDayCents:
        rows.length === 0 ? 0 : Math.round(grandTotal / rows.length),
    },
    rows,
  };
}

function emptyKindRecord(): Record<ArPaymentKind, number> {
  return {
    PROGRESS: 0,
    RETENTION_RELEASE: 0,
    FINAL: 0,
    PARTIAL: 0,
    OTHER: 0,
  };
}
