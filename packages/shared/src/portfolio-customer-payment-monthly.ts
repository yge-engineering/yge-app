// Portfolio AR receipts by month with method mix.
//
// Plain English: per yyyy-mm of receivedOn, count AR payments
// with method mix (CHECK / ACH / WIRE / CARD / CASH / OTHER),
// kind mix (PROGRESS / RETENTION_RELEASE / FINAL / PARTIAL /
// OTHER), distinct payers + jobs. Drives the AR receipts
// trend on the lender's monthly page.
//
// Per row: month, totalPayments, totalCents, byMethod (counts),
// byKind (counts), checkCents, achCents, wireCents, cardCents,
// cashCents, distinctPayers, distinctJobs.
//
// Sort: month asc.
//
// Different from customer-payment-method-monthly (no kind),
// ar-payment-monthly (no kind/method splits in dollars).
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentKind, ArPaymentMethod } from './ar-payment';

export interface PortfolioCustomerPaymentMonthlyRow {
  month: string;
  totalPayments: number;
  totalCents: number;
  byMethod: Partial<Record<ArPaymentMethod, number>>;
  byKind: Partial<Record<ArPaymentKind, number>>;
  checkCents: number;
  achCents: number;
  wireCents: number;
  cardCents: number;
  cashCents: number;
  distinctPayers: number;
  distinctJobs: number;
}

export interface PortfolioCustomerPaymentMonthlyRollup {
  monthsConsidered: number;
  totalPayments: number;
  totalCents: number;
}

export interface PortfolioCustomerPaymentMonthlyInputs {
  arPayments: ArPayment[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioCustomerPaymentMonthly(
  inputs: PortfolioCustomerPaymentMonthlyInputs,
): {
  rollup: PortfolioCustomerPaymentMonthlyRollup;
  rows: PortfolioCustomerPaymentMonthlyRow[];
} {
  type Acc = {
    month: string;
    totalPayments: number;
    totalCents: number;
    byMethod: Map<ArPaymentMethod, number>;
    byKind: Map<ArPaymentKind, number>;
    methodCents: Map<ArPaymentMethod, number>;
    payers: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalPayments = 0;
  let totalCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const p of inputs.arPayments) {
    const month = p.receivedOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        totalPayments: 0,
        totalCents: 0,
        byMethod: new Map(),
        byKind: new Map(),
        methodCents: new Map(),
        payers: new Set(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    const method: ArPaymentMethod = p.method ?? 'CHECK';
    a.totalPayments += 1;
    a.totalCents += p.amountCents;
    a.byMethod.set(method, (a.byMethod.get(method) ?? 0) + 1);
    a.byKind.set(p.kind, (a.byKind.get(p.kind) ?? 0) + 1);
    a.methodCents.set(method, (a.methodCents.get(method) ?? 0) + p.amountCents);
    if (p.payerName) a.payers.add(p.payerName.toLowerCase().trim());
    if (p.jobId) a.jobs.add(p.jobId);
    totalPayments += 1;
    totalCents += p.amountCents;
  }

  const rows: PortfolioCustomerPaymentMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byMethod: Partial<Record<ArPaymentMethod, number>> = {};
      for (const [k, v] of a.byMethod) byMethod[k] = v;
      const byKind: Partial<Record<ArPaymentKind, number>> = {};
      for (const [k, v] of a.byKind) byKind[k] = v;
      return {
        month: a.month,
        totalPayments: a.totalPayments,
        totalCents: a.totalCents,
        byMethod,
        byKind,
        checkCents: a.methodCents.get('CHECK') ?? 0,
        achCents: a.methodCents.get('ACH') ?? 0,
        wireCents: a.methodCents.get('WIRE') ?? 0,
        cardCents: a.methodCents.get('CARD') ?? 0,
        cashCents: a.methodCents.get('CASH') ?? 0,
        distinctPayers: a.payers.size,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: { monthsConsidered: rows.length, totalPayments, totalCents },
    rows,
  };
}
