// Vendor AP payment method by month.
//
// Plain English: bucket non-voided AP payments by yyyy-mm of
// paidOn and count by method. Tracks the shift toward ACH /
// WIRE over CHECK over time. Each ACH eliminates the float +
// mailing time of a check.
//
// Per row: month, total, totalAmountCents, byMethod (count per
// method), checkAmount, achAmount, wireAmount, cardAmount,
// distinctVendors.
//
// Sort by month asc.
//
// Different from vendor-payment-method-mix (per-vendor), and
// ap-payment-monthly (single month-by-method counts but no
// dollar amount per method).
//
// Pure derivation. No persisted records.

import type { ApPayment, ApPaymentMethod } from './ap-payment';

export interface VendorPaymentMethodMonthlyRow {
  month: string;
  total: number;
  totalAmountCents: number;
  byMethod: Partial<Record<ApPaymentMethod, number>>;
  checkAmountCents: number;
  achAmountCents: number;
  wireAmountCents: number;
  cardAmountCents: number;
  distinctVendors: number;
}

export interface VendorPaymentMethodMonthlyRollup {
  monthsConsidered: number;
  totalPayments: number;
  totalAmountCents: number;
  voidedSkipped: number;
}

export interface VendorPaymentMethodMonthlyInputs {
  apPayments: ApPayment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildVendorPaymentMethodMonthly(
  inputs: VendorPaymentMethodMonthlyInputs,
): {
  rollup: VendorPaymentMethodMonthlyRollup;
  rows: VendorPaymentMethodMonthlyRow[];
} {
  type Bucket = {
    month: string;
    total: number;
    amount: number;
    byMethod: Map<ApPaymentMethod, number>;
    checkAmt: number;
    achAmt: number;
    wireAmt: number;
    cardAmt: number;
    vendors: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    total: 0,
    amount: 0,
    byMethod: new Map<ApPaymentMethod, number>(),
    checkAmt: 0,
    achAmt: 0,
    wireAmt: 0,
    cardAmt: 0,
    vendors: new Set<string>(),
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
    b.byMethod.set(p.method, (b.byMethod.get(p.method) ?? 0) + 1);
    if (p.method === 'CHECK') b.checkAmt += p.amountCents;
    else if (p.method === 'ACH') b.achAmt += p.amountCents;
    else if (p.method === 'WIRE') b.wireAmt += p.amountCents;
    else if (p.method === 'CREDIT_CARD') b.cardAmt += p.amountCents;
    b.vendors.add(canonicalize(p.vendorName));
    buckets.set(month, b);
  }

  const rows: VendorPaymentMethodMonthlyRow[] = Array.from(buckets.values())
    .map((b) => {
      const obj: Partial<Record<ApPaymentMethod, number>> = {};
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
        distinctVendors: b.vendors.size,
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
