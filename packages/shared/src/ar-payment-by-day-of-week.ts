// AR payment receipts by day of week.
//
// Plain English: across the AR payment ledger, count receipts +
// dollars by UTC day of week. Tracks the "Caltrans always cuts
// checks on Tuesdays" type pattern.
//
// Per row: dayOfWeek, label, count, totalCents, distinctCustomers.
//
// Sort: Mon-first.
//
// Different from ar-payment-monthly (per-month volume),
// customer-payment-method-monthly (per-month method mix).
//
// Pure derivation. No persisted records.

import type { ArPayment } from './ar-payment';

export interface ArPaymentByDayOfWeekRow {
  dayOfWeek: number;
  label: string;
  count: number;
  totalCents: number;
  distinctCustomers: number;
}

export interface ArPaymentByDayOfWeekRollup {
  daysConsidered: number;
  total: number;
  totalCents: number;
}

export interface ArPaymentByDayOfWeekInputs {
  arPayments: ArPayment[];
  /** Optional yyyy-mm-dd window applied to receivedOn. */
  fromDate?: string;
  toDate?: string;
}

const LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SORT_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function buildArPaymentByDayOfWeek(
  inputs: ArPaymentByDayOfWeekInputs,
): {
  rollup: ArPaymentByDayOfWeekRollup;
  rows: ArPaymentByDayOfWeekRow[];
} {
  type Acc = {
    count: number;
    cents: number;
    customers: Set<string>;
  };
  const accs = new Map<number, Acc>();
  let total = 0;
  let totalCents = 0;

  for (const p of inputs.arPayments) {
    if (inputs.fromDate && p.receivedOn < inputs.fromDate) continue;
    if (inputs.toDate && p.receivedOn > inputs.toDate) continue;
    const dow = dayOfWeekUtc(p.receivedOn);
    if (dow < 0) continue;
    total += 1;
    totalCents += p.amountCents;
    const acc = accs.get(dow) ?? {
      count: 0,
      cents: 0,
      customers: new Set<string>(),
    };
    acc.count += 1;
    acc.cents += p.amountCents;
    if (p.payerName) acc.customers.add(canonicalize(p.payerName));
    accs.set(dow, acc);
  }

  const rows: ArPaymentByDayOfWeekRow[] = [];
  for (const dow of SORT_ORDER) {
    const acc = accs.get(dow);
    if (!acc) continue;
    rows.push({
      dayOfWeek: dow,
      label: LABELS[dow] ?? '',
      count: acc.count,
      totalCents: acc.cents,
      distinctCustomers: acc.customers.size,
    });
  }

  return {
    rollup: {
      daysConsidered: rows.length,
      total,
      totalCents,
    },
    rows,
  };
}

function dayOfWeekUtc(ymd: string): number {
  const t = Date.parse(ymd + 'T00:00:00Z');
  if (Number.isNaN(t)) return -1;
  return new Date(t).getUTCDay();
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
