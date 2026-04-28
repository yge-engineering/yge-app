// Per-vendor AP payment method mix.
//
// Plain English: bucket AP payments by canonical vendor name and
// break down the count + \$ by method (CHECK / ACH / WIRE / CARD
// / CASH / OTHER). Switching a high-volume CHECK vendor to ACH
// cuts mailing time and float — that's the action this surfaces.
//
// Per row: per-method counts + \$ + share, totalAmount,
// dominantMethod (highest-\$). Sort by totalAmount desc.
//
// Different from vendor-payment-velocity (timing buckets) and
// vendor-1099-ytd-threshold (year-end). This is the channel-of-
// payment view on the AP side, mirror of customer-payment-method-mix.
//
// Pure derivation. No persisted records.

import type { ApPayment, ApPaymentMethod } from './ap-payment';

export interface VendorPaymentMethodEntry {
  count: number;
  amountCents: number;
  share: number;
}

export interface VendorPaymentMethodRow {
  vendorName: string;
  totalPayments: number;
  totalAmountCents: number;
  byMethod: Partial<Record<ApPaymentMethod, VendorPaymentMethodEntry>>;
  dominantMethod: ApPaymentMethod | null;
}

export interface VendorPaymentMethodRollup {
  vendorsConsidered: number;
  totalPayments: number;
  totalAmountCents: number;
  portfolioByMethod: Partial<Record<ApPaymentMethod, number>>;
}

export interface VendorPaymentMethodInputs {
  apPayments: ApPayment[];
  /** Optional yyyy-mm-dd window applied to paidOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildVendorPaymentMethodMix(
  inputs: VendorPaymentMethodInputs,
): {
  rollup: VendorPaymentMethodRollup;
  rows: VendorPaymentMethodRow[];
} {
  type Acc = {
    display: string;
    counts: Map<ApPaymentMethod, { count: number; amount: number }>;
    totalAmount: number;
    totalCount: number;
  };
  const accs = new Map<string, Acc>();

  for (const p of inputs.apPayments) {
    if (p.voided) continue;
    if (inputs.fromDate && p.paidOn < inputs.fromDate) continue;
    if (inputs.toDate && p.paidOn > inputs.toDate) continue;
    const key = canonicalize(p.vendorName);
    const acc = accs.get(key) ?? {
      display: p.vendorName,
      counts: new Map<ApPaymentMethod, { count: number; amount: number }>(),
      totalAmount: 0,
      totalCount: 0,
    };
    const cur = acc.counts.get(p.method) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += p.amountCents;
    acc.counts.set(p.method, cur);
    acc.totalAmount += p.amountCents;
    acc.totalCount += 1;
    accs.set(key, acc);
  }

  let totalPayments = 0;
  let totalAmount = 0;
  const portfolio = new Map<ApPaymentMethod, number>();

  const rows: VendorPaymentMethodRow[] = [];
  for (const acc of accs.values()) {
    const byMethod: VendorPaymentMethodRow['byMethod'] = {};
    let dominant: ApPaymentMethod | null = null;
    let dominantAmt = 0;
    for (const [method, v] of acc.counts.entries()) {
      const share = acc.totalAmount === 0
        ? 0
        : Math.round((v.amount / acc.totalAmount) * 10_000) / 10_000;
      byMethod[method] = { count: v.count, amountCents: v.amount, share };
      if (v.amount > dominantAmt) {
        dominantAmt = v.amount;
        dominant = method;
      }
      portfolio.set(method, (portfolio.get(method) ?? 0) + v.amount);
    }
    rows.push({
      vendorName: acc.display,
      totalPayments: acc.totalCount,
      totalAmountCents: acc.totalAmount,
      byMethod,
      dominantMethod: dominant,
    });
    totalPayments += acc.totalCount;
    totalAmount += acc.totalAmount;
  }

  rows.sort((a, b) => b.totalAmountCents - a.totalAmountCents);

  const portfolioObj: Partial<Record<ApPaymentMethod, number>> = {};
  for (const [k, v] of portfolio.entries()) portfolioObj[k] = v;

  return {
    rollup: {
      vendorsConsidered: rows.length,
      totalPayments,
      totalAmountCents: totalAmount,
      portfolioByMethod: portfolioObj,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
