// Per (customer, month) AR payment receipts.
//
// Plain English: bucket AR payments by (canonicalized payerName,
// yyyy-mm of receivedOn). Long-format. Useful for the per-
// customer cash trend.
//
// Per row: customerName, month, totalCents, paymentCount,
// distinctMethods.
//
// Sort: customerName asc, month asc.
//
// Different from ar-payment-monthly (portfolio per month, no
// customer axis), customer-payment-method-monthly (portfolio
// per month + method), customer-revenue-by-month (invoices, not
// receipts).
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentMethod } from './ar-payment';

export interface CustomerPaymentByCustomerMonthlyRow {
  customerName: string;
  month: string;
  totalCents: number;
  paymentCount: number;
  distinctMethods: number;
}

export interface CustomerPaymentByCustomerMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalCents: number;
}

export interface CustomerPaymentByCustomerMonthlyInputs {
  arPayments: ArPayment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerPaymentByCustomerMonthly(
  inputs: CustomerPaymentByCustomerMonthlyInputs,
): {
  rollup: CustomerPaymentByCustomerMonthlyRollup;
  rows: CustomerPaymentByCustomerMonthlyRow[];
} {
  type Acc = {
    display: string;
    month: string;
    cents: number;
    count: number;
    methods: Set<ArPaymentMethod>;
  };
  const accs = new Map<string, Acc>();
  const customerSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalCents = 0;

  for (const p of inputs.arPayments) {
    const month = p.receivedOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const display = p.payerName ?? '';
    if (!display) continue;
    const canonical = canonicalize(display);
    const key = `${canonical}|${month}`;
    const acc = accs.get(key) ?? {
      display,
      month,
      cents: 0,
      count: 0,
      methods: new Set<ArPaymentMethod>(),
    };
    acc.cents += p.amountCents;
    acc.count += 1;
    acc.methods.add(p.method);
    accs.set(key, acc);
    customerSet.add(canonical);
    monthSet.add(month);
    totalCents += p.amountCents;
  }

  const rows: CustomerPaymentByCustomerMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      customerName: acc.display,
      month: acc.month,
      totalCents: acc.cents,
      paymentCount: acc.count,
      distinctMethods: acc.methods.size,
    });
  }

  rows.sort((a, b) => {
    if (a.customerName !== b.customerName) return a.customerName.localeCompare(b.customerName);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      customersConsidered: customerSet.size,
      monthsConsidered: monthSet.size,
      totalCents,
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
