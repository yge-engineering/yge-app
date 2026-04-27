// Daily cash net (in vs out).
//
// Plain English: per day in window, what cash came IN (AR receipts)
// vs what cash went OUT (AP payments)? The net (in - out) per day
// is the daily liquidity move. Stack them and you have the running
// cash trajectory — useful for the morning "do we have enough to
// clear Friday's check run" check.
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

export interface DailyCashNetRow {
  date: string;
  receiptsCents: number;
  receiptCount: number;
  paymentsCents: number;
  paymentCount: number;
  /** receipts - payments. Negative = net cash out that day. */
  netCents: number;
  /** Running cumulative net across the window (each row carries
   *  the running total through that day). */
  cumulativeNetCents: number;
}

export interface DailyCashNetRollup {
  daysWithActivity: number;
  totalReceiptsCents: number;
  totalPaymentsCents: number;
  netCents: number;
  /** Lowest single-day cumulative net — the trough. Useful for
   *  "what was our worst cash day this period?" */
  troughCumulativeNetCents: number;
  troughDate: string | null;
}

export interface DailyCashNetInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  arPayments: ArPayment[];
  apPayments: ApPayment[];
}

export function buildDailyCashNet(inputs: DailyCashNetInputs): {
  rollup: DailyCashNetRollup;
  rows: DailyCashNetRow[];
} {
  type Bucket = {
    date: string;
    receipts: number;
    rcount: number;
    payments: number;
    pcount: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of inputs.arPayments) {
    if (r.receivedOn < inputs.fromDate) continue;
    if (r.receivedOn > inputs.toDate) continue;
    const b = buckets.get(r.receivedOn) ?? {
      date: r.receivedOn,
      receipts: 0,
      rcount: 0,
      payments: 0,
      pcount: 0,
    };
    b.receipts += r.amountCents;
    b.rcount += 1;
    buckets.set(r.receivedOn, b);
  }

  for (const p of inputs.apPayments) {
    if (p.paidOn < inputs.fromDate) continue;
    if (p.paidOn > inputs.toDate) continue;
    const b = buckets.get(p.paidOn) ?? {
      date: p.paidOn,
      receipts: 0,
      rcount: 0,
      payments: 0,
      pcount: 0,
    };
    b.payments += p.amountCents;
    b.pcount += 1;
    buckets.set(p.paidOn, b);
  }

  const sorted = Array.from(buckets.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const rows: DailyCashNetRow[] = [];
  let totalReceipts = 0;
  let totalPayments = 0;
  let running = 0;
  let trough = 0;
  let troughDate: string | null = null;

  for (const b of sorted) {
    const net = b.receipts - b.payments;
    running += net;
    rows.push({
      date: b.date,
      receiptsCents: b.receipts,
      receiptCount: b.rcount,
      paymentsCents: b.payments,
      paymentCount: b.pcount,
      netCents: net,
      cumulativeNetCents: running,
    });
    totalReceipts += b.receipts;
    totalPayments += b.payments;
    if (running < trough || troughDate === null) {
      trough = running;
      troughDate = b.date;
    }
  }

  return {
    rollup: {
      daysWithActivity: rows.length,
      totalReceiptsCents: totalReceipts,
      totalPaymentsCents: totalPayments,
      netCents: totalReceipts - totalPayments,
      troughCumulativeNetCents: trough,
      troughDate,
    },
    rows,
  };
}
