// AR payment receipts by ArPaymentKind by month.
//
// Plain English: bucket AR payments by (yyyy-mm of receivedOn,
// ArPaymentKind: PROGRESS / RETENTION_RELEASE / FINAL / PARTIAL
// / OTHER). Useful for the "retention finally landing" trend
// view.
//
// Per row: month, kind, count, totalCents.
//
// Sort: month asc, kind asc.
//
// Different from ar-payment-monthly (per-month combined),
// customer-payment-method-monthly (method axis).
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentKind } from './ar-payment';

export interface ArPaymentByKindMonthlyRow {
  month: string;
  kind: ArPaymentKind;
  count: number;
  totalCents: number;
}

export interface ArPaymentByKindMonthlyRollup {
  monthsConsidered: number;
  kindsConsidered: number;
  totalPayments: number;
  totalCents: number;
}

export interface ArPaymentByKindMonthlyInputs {
  arPayments: ArPayment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildArPaymentByKindMonthly(
  inputs: ArPaymentByKindMonthlyInputs,
): {
  rollup: ArPaymentByKindMonthlyRollup;
  rows: ArPaymentByKindMonthlyRow[];
} {
  type Acc = {
    month: string;
    kind: ArPaymentKind;
    count: number;
    cents: number;
  };
  const accs = new Map<string, Acc>();
  const monthSet = new Set<string>();
  const kindSet = new Set<ArPaymentKind>();
  let totalPayments = 0;
  let totalCents = 0;

  for (const p of inputs.arPayments) {
    const month = p.receivedOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${month}|${p.kind}`;
    const acc = accs.get(key) ?? {
      month,
      kind: p.kind,
      count: 0,
      cents: 0,
    };
    acc.count += 1;
    acc.cents += p.amountCents;
    accs.set(key, acc);
    monthSet.add(month);
    kindSet.add(p.kind);
    totalPayments += 1;
    totalCents += p.amountCents;
  }

  const rows: ArPaymentByKindMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      month: acc.month,
      kind: acc.kind,
      count: acc.count,
      totalCents: acc.cents,
    });
  }

  rows.sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    return a.kind.localeCompare(b.kind);
  });

  return {
    rollup: {
      monthsConsidered: monthSet.size,
      kindsConsidered: kindSet.size,
      totalPayments,
      totalCents,
    },
    rows,
  };
}
