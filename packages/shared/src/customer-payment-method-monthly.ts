// Customer AR payment method by month.
//
// Plain English: per yyyy-mm, sum AR receipts by method (CHECK
// / ACH / WIRE / CARD / CASH / OTHER). Tracks ACH adoption on
// the receivables side over time. Cash discounts on ACH only
// matter when most customers actually pay by ACH — this
// quantifies that.
//
// Per row: month, total, totalAmountCents, byMethod (count),
// checkAmount, achAmount, wireAmount, cardAmount, cashAmount,
// distinctCustomers.
//
// Sort by month asc.
//
// Different from customer-payment-method-mix (per-customer),
// ar-payment-monthly (count + dollars total, no per-method
// dollar split).
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentMethod } from './ar-payment';

export interface CustomerPaymentMethodMonthlyRow {
  month: string;
  total: number;
  totalAmountCents: number;
  byMethod: Partial<Record<ArPaymentMethod, number>>;
  checkAmountCents: number;
  achAmountCents: number;
  wireAmountCents: number;
  cardAmountCents: number;
  cashAmountCents: number;
  distinctCustomers: number;
}

export interface CustomerPaymentMethodMonthlyRollup {
  monthsConsidered: number;
  totalPayments: number;
  totalAmountCents: number;
}

export interface CustomerPaymentMethodMonthlyInputs {
  arPayments: ArPayment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerPaymentMethodMonthly(
  inputs: CustomerPaymentMethodMonthlyInputs,
): {
  rollup: CustomerPaymentMethodMonthlyRollup;
  rows: CustomerPaymentMethodMonthlyRow[];
} {
  type Bucket = {
    month: string;
    total: number;
    amount: number;
    byMethod: Map<ArPaymentMethod, number>;
    checkAmt: number;
    achAmt: number;
    wireAmt: number;
    cardAmt: number;
    cashAmt: number;
    customers: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    total: 0,
    amount: 0,
    byMethod: new Map<ArPaymentMethod, number>(),
    checkAmt: 0,
    achAmt: 0,
    wireAmt: 0,
    cardAmt: 0,
    cashAmt: 0,
    customers: new Set<string>(),
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
    b.byMethod.set(p.method, (b.byMethod.get(p.method) ?? 0) + 1);
    if (p.method === 'CHECK') b.checkAmt += p.amountCents;
    else if (p.method === 'ACH') b.achAmt += p.amountCents;
    else if (p.method === 'WIRE') b.wireAmt += p.amountCents;
    else if (p.method === 'CARD') b.cardAmt += p.amountCents;
    else if (p.method === 'CASH') b.cashAmt += p.amountCents;
    if (p.payerName) b.customers.add(canonicalize(p.payerName));
    buckets.set(month, b);
  }

  const rows: CustomerPaymentMethodMonthlyRow[] = Array.from(buckets.values())
    .map((b) => {
      const obj: Partial<Record<ArPaymentMethod, number>> = {};
      for (const [k, v] of b.byMethod.entries()) obj[k] = v;
      return {
        month: b.month,
        total: b.total,
        totalAmountCents: b.amount,
        byMethod: obj,
        checkAmountCents: b.checkAmt,
        achAmountCents: b.achAmt,
        wireAmountCents: b.wireAmt,
        cardAmountCents: b.cardAmt,
        cashAmountCents: b.cashAmt,
        distinctCustomers: b.customers.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

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
