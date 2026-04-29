// AP payments by day of week.
//
// Plain English: across the AP payment ledger, count payments +
// dollars by UTC day of week. We cut checks Friday afternoons,
// ACH on Tuesday mornings — this verifies the bookkeeping
// rhythm.
//
// Per row: dayOfWeek, label, count, totalCents, distinctVendors.
//
// Sort: Mon-first.
//
// Voided payments skipped.
//
// Different from ap-payment-monthly (per-month volume),
// vendor-payment-method-monthly (per-month method dollars).
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';

export interface ApPaymentByDayOfWeekRow {
  dayOfWeek: number;
  label: string;
  count: number;
  totalCents: number;
  distinctVendors: number;
}

export interface ApPaymentByDayOfWeekRollup {
  daysConsidered: number;
  total: number;
  totalCents: number;
  voidedSkipped: number;
}

export interface ApPaymentByDayOfWeekInputs {
  apPayments: ApPayment[];
  /** Optional yyyy-mm-dd window applied to paidOn. */
  fromDate?: string;
  toDate?: string;
}

const LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SORT_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function buildApPaymentByDayOfWeek(
  inputs: ApPaymentByDayOfWeekInputs,
): {
  rollup: ApPaymentByDayOfWeekRollup;
  rows: ApPaymentByDayOfWeekRow[];
} {
  type Acc = {
    count: number;
    cents: number;
    vendors: Set<string>;
  };
  const accs = new Map<number, Acc>();
  let total = 0;
  let totalCents = 0;
  let voidedSkipped = 0;

  for (const p of inputs.apPayments) {
    if (p.voided) {
      voidedSkipped += 1;
      continue;
    }
    if (inputs.fromDate && p.paidOn < inputs.fromDate) continue;
    if (inputs.toDate && p.paidOn > inputs.toDate) continue;
    const dow = dayOfWeekUtc(p.paidOn);
    if (dow < 0) continue;
    total += 1;
    totalCents += p.amountCents;
    const acc = accs.get(dow) ?? {
      count: 0,
      cents: 0,
      vendors: new Set<string>(),
    };
    acc.count += 1;
    acc.cents += p.amountCents;
    acc.vendors.add(canonicalize(p.vendorName));
    accs.set(dow, acc);
  }

  const rows: ApPaymentByDayOfWeekRow[] = [];
  for (const dow of SORT_ORDER) {
    const acc = accs.get(dow);
    if (!acc) continue;
    rows.push({
      dayOfWeek: dow,
      label: LABELS[dow] ?? '',
      count: acc.count,
      totalCents: acc.cents,
      distinctVendors: acc.vendors.size,
    });
  }

  return {
    rollup: {
      daysConsidered: rows.length,
      total,
      totalCents,
      voidedSkipped,
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
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
