// Monthly cash net (in vs out).
//
// Plain English: per month in window, what cash came IN (AR
// receipts) vs what cash went OUT (AP payments)? The net per
// month is the monthly liquidity move. Stack them and you have
// the rolling cash trajectory — useful for the quarterly review
// and the lender's "show me the trend" page.
//
// Per row: month (yyyy-mm), receiptsCents, receiptCount,
// paymentsCents, paymentCount, netCents, cumulativeNetCents.
//
// Sort by month asc.
//
// Voided AP payments are skipped. AR payments have no voided
// flag, so all are counted.
//
// Different from daily-cash-net (daily granularity),
// cash-position (current snapshot), cash-forecast (forward-
// looking), and monthly-billing (AR invoices, not receipts).
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

export interface MonthlyCashNetRow {
  month: string;
  receiptsCents: number;
  receiptCount: number;
  paymentsCents: number;
  paymentCount: number;
  /** receipts - payments. Negative = net cash out that month. */
  netCents: number;
  /** Running cumulative net across the window (each row carries
   *  the running total through that month). */
  cumulativeNetCents: number;
}

export interface MonthlyCashNetRollup {
  monthsConsidered: number;
  receiptsCents: number;
  paymentsCents: number;
  netCents: number;
  monthOverMonthNetChange: number;
}

export interface MonthlyCashNetInputs {
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildMonthlyCashNet(
  inputs: MonthlyCashNetInputs,
): {
  rollup: MonthlyCashNetRollup;
  rows: MonthlyCashNetRow[];
} {
  type Bucket = {
    month: string;
    receipts: number;
    receiptCount: number;
    payments: number;
    paymentCount: number;
  };
  const fresh = (month: string): Bucket => ({
    month,
    receipts: 0,
    receiptCount: 0,
    payments: 0,
    paymentCount: 0,
  });
  const buckets = new Map<string, Bucket>();

  for (const p of inputs.arPayments) {
    const month = p.receivedOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.receipts += p.amountCents;
    b.receiptCount += 1;
    buckets.set(month, b);
  }

  for (const p of inputs.apPayments) {
    if (p.voided) continue;
    const month = p.paidOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.payments += p.amountCents;
    b.paymentCount += 1;
    buckets.set(month, b);
  }

  const sortedBuckets = Array.from(buckets.values())
    .sort((a, b) => a.month.localeCompare(b.month));

  let running = 0;
  const rows: MonthlyCashNetRow[] = sortedBuckets.map((b) => {
    const net = b.receipts - b.payments;
    running += net;
    return {
      month: b.month,
      receiptsCents: b.receipts,
      receiptCount: b.receiptCount,
      paymentsCents: b.payments,
      paymentCount: b.paymentCount,
      netCents: net,
      cumulativeNetCents: running,
    };
  });

  let totalReceipts = 0;
  let totalPayments = 0;
  for (const r of rows) {
    totalReceipts += r.receiptsCents;
    totalPayments += r.paymentsCents;
  }

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.netCents - prev.netCents;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      receiptsCents: totalReceipts,
      paymentsCents: totalPayments,
      netCents: totalReceipts - totalPayments,
      monthOverMonthNetChange: mom,
    },
    rows,
  };
}
