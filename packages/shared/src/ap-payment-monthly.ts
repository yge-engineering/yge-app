// AP payment volume by month.
//
// Plain English: bucket non-voided AP payments by yyyy-mm of
// paidOn so the bookkeeper sees how much money walked out the
// door each month, broken down by method (CHECK / ACH / WIRE /
// CREDIT_CARD / CASH / OTHER) and cleared vs uncleared.
//
// Per row: month, total, totalAmountCents, cleared, clearedCents,
// uncleared, unclearedCents, distinctVendors, byMethod (count
// per method).
//
// Sort by month asc.
//
// Different from ap-monthly-volume (invoices, not payments),
// ap-check-run (payment-run snapshot), and vendor-payment-
// velocity (per-vendor timing).
//
// Pure derivation. No persisted records.

import type { ApPayment, ApPaymentMethod } from './ap-payment';

export interface ApPaymentMonthlyRow {
  month: string;
  total: number;
  totalAmountCents: number;
  cleared: number;
  clearedCents: number;
  uncleared: number;
  unclearedCents: number;
  distinctVendors: number;
  byMethod: Partial<Record<ApPaymentMethod, number>>;
}

export interface ApPaymentMonthlyRollup {
  monthsConsidered: number;
  totalPayments: number;
  totalAmountCents: number;
  voidedSkipped: number;
}

export interface ApPaymentMonthlyInputs {
  apPayments: ApPayment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildApPaymentMonthly(
  inputs: ApPaymentMonthlyInputs,
): {
  rollup: ApPaymentMonthlyRollup;
  rows: ApPaymentMonthlyRow[];
} {
  type Bucket = {
    month: string;
    total: number;
    amount: number;
    cleared: number;
    clearedAmt: number;
    uncleared: number;
    unclearedAmt: number;
    vendors: Set<string>;
    byMethod: Map<ApPaymentMethod, number>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    total: 0,
    amount: 0,
    cleared: 0,
    clearedAmt: 0,
    uncleared: 0,
    unclearedAmt: 0,
    vendors: new Set<string>(),
    byMethod: new Map<ApPaymentMethod, number>(),
  });
  const buckets = new Map<string, Bucket>();
  let voidedSkipped = 0;

  for (const p of inputs.apPayments) {
    if (p.voided) {
      voidedSkipped += 1;
      continue;
    }
    const month = p.paidOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.total += 1;
    b.amount += p.amountCents;
    if (p.cleared) {
      b.cleared += 1;
      b.clearedAmt += p.amountCents;
    } else {
      b.uncleared += 1;
      b.unclearedAmt += p.amountCents;
    }
    b.vendors.add(canonicalize(p.vendorName));
    b.byMethod.set(p.method, (b.byMethod.get(p.method) ?? 0) + 1);
    buckets.set(month, b);
  }

  const rows: ApPaymentMonthlyRow[] = Array.from(buckets.values())
    .map((b) => {
      const obj: Partial<Record<ApPaymentMethod, number>> = {};
      for (const [k, v] of b.byMethod.entries()) obj[k] = v;
      return {
        month: b.month,
        total: b.total,
        totalAmountCents: b.amount,
        cleared: b.cleared,
        clearedCents: b.clearedAmt,
        uncleared: b.uncleared,
        unclearedCents: b.unclearedAmt,
        distinctVendors: b.vendors.size,
        byMethod: obj,
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
      voidedSkipped,
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
