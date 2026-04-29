// Portfolio AP payment activity by month with method mix.
//
// Plain English: per yyyy-mm of paidOn, count non-voided AP
// payments with method mix (CHECK / ACH / WIRE / CREDIT_CARD /
// CASH / OTHER), sum total cents per method. Drives the
// "are we shifting off paper checks" trend.
//
// Per row: month, totalPayments, totalCents, byMethodCount,
// checkCents, achCents, wireCents, creditCardCents, cashCents,
// otherCents, distinctVendors.
//
// Sort: month asc.
//
// Different from vendor-payment-method-monthly (no method-
// specific dollar split + no distinct vendors), ap-payment-
// monthly (no method axis), portfolio-cash-net-monthly (cash
// net, no method).
//
// Pure derivation. No persisted records.

import type { ApPayment, ApPaymentMethod } from './ap-payment';

export interface PortfolioVendorPaymentMonthlyRow {
  month: string;
  totalPayments: number;
  totalCents: number;
  byMethodCount: Partial<Record<ApPaymentMethod, number>>;
  checkCents: number;
  achCents: number;
  wireCents: number;
  creditCardCents: number;
  cashCents: number;
  otherCents: number;
  distinctVendors: number;
}

export interface PortfolioVendorPaymentMonthlyRollup {
  monthsConsidered: number;
  totalPayments: number;
  totalCents: number;
  voidedSkipped: number;
}

export interface PortfolioVendorPaymentMonthlyInputs {
  apPayments: ApPayment[];
  fromMonth?: string;
  toMonth?: string;
}

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPortfolioVendorPaymentMonthly(
  inputs: PortfolioVendorPaymentMonthlyInputs,
): {
  rollup: PortfolioVendorPaymentMonthlyRollup;
  rows: PortfolioVendorPaymentMonthlyRow[];
} {
  type Acc = {
    month: string;
    totalPayments: number;
    totalCents: number;
    byMethodCount: Map<ApPaymentMethod, number>;
    byMethodCents: Map<ApPaymentMethod, number>;
    vendors: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalPayments = 0;
  let totalCents = 0;
  let voidedSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const p of inputs.apPayments) {
    const month = p.paidOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (p.voided) {
      voidedSkipped += 1;
      continue;
    }

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        totalPayments: 0,
        totalCents: 0,
        byMethodCount: new Map(),
        byMethodCents: new Map(),
        vendors: new Set(),
      };
      accs.set(month, a);
    }
    const method: ApPaymentMethod = p.method ?? 'CHECK';
    a.totalPayments += 1;
    a.totalCents += p.amountCents;
    a.byMethodCount.set(method, (a.byMethodCount.get(method) ?? 0) + 1);
    a.byMethodCents.set(method, (a.byMethodCents.get(method) ?? 0) + p.amountCents);
    a.vendors.add(normVendor(p.vendorName));
    totalPayments += 1;
    totalCents += p.amountCents;
  }

  const rows: PortfolioVendorPaymentMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byMethodCount: Partial<Record<ApPaymentMethod, number>> = {};
      for (const [k, v] of a.byMethodCount) byMethodCount[k] = v;
      return {
        month: a.month,
        totalPayments: a.totalPayments,
        totalCents: a.totalCents,
        byMethodCount,
        checkCents: a.byMethodCents.get('CHECK') ?? 0,
        achCents: a.byMethodCents.get('ACH') ?? 0,
        wireCents: a.byMethodCents.get('WIRE') ?? 0,
        creditCardCents: a.byMethodCents.get('CREDIT_CARD') ?? 0,
        cashCents: a.byMethodCents.get('CASH') ?? 0,
        otherCents: a.byMethodCents.get('OTHER') ?? 0,
        distinctVendors: a.vendors.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: { monthsConsidered: rows.length, totalPayments, totalCents, voidedSkipped },
    rows,
  };
}
