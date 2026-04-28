// Per-customer AR payment method mix.
//
// Plain English: bucket AR payments by their customer (joined
// via the AR invoice's customerName) and break the count + \$
// down by payment method (ACH / CHECK / WIRE / CARD / CASH /
// OTHER). Wire and ACH customers settle faster than check
// customers — useful for treasury planning + when YGE wants to
// nudge customers off mailed checks.
//
// Per row: per-method counts + \$ + share-of-amount, totalAmount,
// dominantMethod (the highest-\$ method per customer).
//
// Different from customer-payment-velocity (early/on-time/late
// buckets), customer-first-payment-timing (lag), and
// customer-payment-lag (percentile distribution). This is the
// channel-of-payment view.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment, ArPaymentMethod } from './ar-payment';

export interface CustomerMethodMixRow {
  customerName: string;
  totalPayments: number;
  totalAmountCents: number;
  byMethod: Partial<Record<ArPaymentMethod, { count: number; amountCents: number; share: number }>>;
  dominantMethod: ArPaymentMethod | null;
}

export interface CustomerMethodMixRollup {
  customersConsidered: number;
  totalPayments: number;
  totalAmountCents: number;
  /** Total amount per method across the portfolio. */
  portfolioByMethod: Partial<Record<ArPaymentMethod, number>>;
}

export interface CustomerMethodMixInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  /** Optional yyyy-mm-dd window applied to receivedOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildCustomerPaymentMethodMix(
  inputs: CustomerMethodMixInputs,
): {
  rollup: CustomerMethodMixRollup;
  rows: CustomerMethodMixRow[];
} {
  // Map arInvoiceId → canonical customer key + display.
  const invoiceToCustKey = new Map<string, string>();
  const displayByKey = new Map<string, string>();
  for (const inv of inputs.arInvoices) {
    const key = canonicalize(inv.customerName);
    invoiceToCustKey.set(inv.id, key);
    if (!displayByKey.has(key)) displayByKey.set(key, inv.customerName);
  }

  // Bucket payments by customer key.
  type Acc = {
    display: string;
    counts: Map<ArPaymentMethod, { count: number; amount: number }>;
    totalAmount: number;
    totalCount: number;
  };
  const accs = new Map<string, Acc>();
  for (const p of inputs.arPayments) {
    if (inputs.fromDate && p.receivedOn < inputs.fromDate) continue;
    if (inputs.toDate && p.receivedOn > inputs.toDate) continue;
    const key = invoiceToCustKey.get(p.arInvoiceId);
    if (!key) continue; // payment with no matching invoice
    const acc = accs.get(key) ?? {
      display: displayByKey.get(key) ?? key,
      counts: new Map(),
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
  const portfolioByMethod = new Map<ArPaymentMethod, number>();

  const rows: CustomerMethodMixRow[] = [];
  for (const acc of accs.values()) {
    const byMethod: CustomerMethodMixRow['byMethod'] = {};
    let dominant: ArPaymentMethod | null = null;
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
      portfolioByMethod.set(method, (portfolioByMethod.get(method) ?? 0) + v.amount);
    }

    rows.push({
      customerName: acc.display,
      totalPayments: acc.totalCount,
      totalAmountCents: acc.totalAmount,
      byMethod,
      dominantMethod: dominant,
    });

    totalPayments += acc.totalCount;
    totalAmount += acc.totalAmount;
  }

  rows.sort((a, b) => b.totalAmountCents - a.totalAmountCents);

  const portfolioObj: Partial<Record<ArPaymentMethod, number>> = {};
  for (const [k, v] of portfolioByMethod.entries()) portfolioObj[k] = v;

  return {
    rollup: {
      customersConsidered: rows.length,
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
