// Cash flow statement (direct method) — period-bounded summary
// of cash inflows + outflows from cleared transactions.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Expense } from './expense';

export type CashFlowActivity = 'OPERATING' | 'INVESTING' | 'FINANCING';

export interface CashFlowLine {
  label: string;
  /** Integer cents. Positive = inflow, negative = outflow. */
  amountCents: number;
  /** How many transactions back this line. */
  count: number;
}

export interface CashFlowSection {
  activity: CashFlowActivity;
  label: string;
  lines: CashFlowLine[];
  /** Net for this activity (sum of line amounts). */
  totalCents: number;
}

export interface CashFlow {
  periodStart: string;
  periodEnd: string;
  sections: CashFlowSection[];
  /** Net change in cash for the period (sum across sections). */
  netChangeCents: number;
  /** Counts for the metadata strip. */
  arPaymentsCount: number;
  apPaymentsCount: number;
  expensesCount: number;
}

function inPeriod(
  isoDate: string | undefined,
  periodStart: string,
  periodEnd: string,
): boolean {
  if (!isoDate) return false;
  return isoDate >= periodStart && isoDate <= periodEnd;
}

function bucketize<T>(
  rows: T[],
  keyOf: (r: T) => string,
  amountOf: (r: T) => number,
): Map<string, { amountCents: number; count: number }> {
  const out = new Map<string, { amountCents: number; count: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = out.get(k) ?? { amountCents: 0, count: 0 };
    cur.amountCents += amountOf(r);
    cur.count += 1;
    out.set(k, cur);
  }
  return out;
}

export function buildCashFlow(args: {
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  expenses: Expense[];
  periodStart: string;
  periodEnd: string;
}): CashFlow {
  const { arPayments, apPayments, expenses, periodStart, periodEnd } = args;

  // Filter rows to "cleared in period". For AR + AP the clearance
  // signal is `cleared && clearedOn` set inside the window; for
  // expenses we accept either cleared+clearedOn or — when the
  // bookkeeper hasn't flipped cleared yet — fall back to
  // receiptDate so the page still shows something useful before
  // bank-rec Apply has been run.
  const arRows = arPayments.filter((p) => {
    if (!p.cleared) return false;
    return inPeriod(p.clearedOn, periodStart, periodEnd);
  });
  const apRows = apPayments.filter((p) => {
    if (!p.cleared) return false;
    return inPeriod(p.clearedOn, periodStart, periodEnd);
  });
  const expRows = expenses.filter((e) => {
    if (e.cleared && e.clearedOn) {
      return inPeriod(e.clearedOn, periodStart, periodEnd);
    }
    return inPeriod(e.receiptDate, periodStart, periodEnd);
  });

  // Operating section.
  const arByKind = bucketize(
    arRows,
    (p) => p.kind,
    (p) => p.amountCents, // inflow = positive
  );
  const apByMethod = bucketize(
    apRows,
    (p) => p.method,
    (p) => -p.amountCents, // outflow = negative
  );
  const expByCategory = bucketize(
    expRows,
    (e) => e.category,
    (e) => -e.amountCents,
  );

  const operatingLines: CashFlowLine[] = [
    ...[...arByKind.entries()].map(([kind, v]) => ({
      label: `AR payments — ${kind}`,
      amountCents: v.amountCents,
      count: v.count,
    })),
    ...[...apByMethod.entries()].map(([method, v]) => ({
      label: `AP payments — ${method}`,
      amountCents: v.amountCents,
      count: v.count,
    })),
    ...[...expByCategory.entries()].map(([cat, v]) => ({
      label: `Expenses — ${cat}`,
      amountCents: v.amountCents,
      count: v.count,
    })),
  ];
  // Sort: inflows first by amount desc, then outflows by amount asc.
  operatingLines.sort((a, b) => {
    if (a.amountCents >= 0 && b.amountCents < 0) return -1;
    if (a.amountCents < 0 && b.amountCents >= 0) return 1;
    return a.amountCents >= 0
      ? b.amountCents - a.amountCents
      : a.amountCents - b.amountCents;
  });

  const operating: CashFlowSection = {
    activity: 'OPERATING',
    label: 'Operating activities',
    lines: operatingLines,
    totalCents: operatingLines.reduce((s, l) => s + l.amountCents, 0),
  };

  // Investing + financing — placeholders for now. Equipment buys/
  // sells + loan draws/repayments wire here when their stores
  // grow a cleared flag of their own.
  const investing: CashFlowSection = {
    activity: 'INVESTING',
    label: 'Investing activities',
    lines: [],
    totalCents: 0,
  };
  const financing: CashFlowSection = {
    activity: 'FINANCING',
    label: 'Financing activities',
    lines: [],
    totalCents: 0,
  };

  const sections = [operating, investing, financing];
  const netChangeCents = sections.reduce((s, sec) => s + sec.totalCents, 0);

  return {
    periodStart,
    periodEnd,
    sections,
    netChangeCents,
    arPaymentsCount: arRows.length,
    apPaymentsCount: apRows.length,
    expensesCount: expRows.length,
  };
}
