// Portfolio AP payment year-over-year.
//
// Plain English: collapse two years of non-voided AP payments
// into a comparison row with method mix + per-method dollar
// split + distinct vendors + delta.
//
// Different from portfolio-vendor-payment-monthly (per month).
//
// Pure derivation. No persisted records.

import type { ApPayment, ApPaymentMethod } from './ap-payment';

export interface PortfolioVendorPaymentYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotalPayments: number;
  priorTotalCents: number;
  priorByMethod: Partial<Record<ApPaymentMethod, number>>;
  priorDistinctVendors: number;
  currentTotalPayments: number;
  currentTotalCents: number;
  currentByMethod: Partial<Record<ApPaymentMethod, number>>;
  currentDistinctVendors: number;
  totalCentsDelta: number;
  voidedSkipped: number;
}

export interface PortfolioVendorPaymentYoyInputs {
  apPayments: ApPayment[];
  currentYear: number;
}

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPortfolioVendorPaymentYoy(
  inputs: PortfolioVendorPaymentYoyInputs,
): PortfolioVendorPaymentYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    totalPayments: number;
    totalCents: number;
    byMethod: Map<ApPaymentMethod, number>;
    vendors: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      totalPayments: 0,
      totalCents: 0,
      byMethod: new Map(),
      vendors: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();
  let voidedSkipped = 0;

  for (const p of inputs.apPayments) {
    if (p.voided) {
      voidedSkipped += 1;
      continue;
    }
    const year = Number(p.paidOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.totalPayments += 1;
    b.totalCents += p.amountCents;
    const method: ApPaymentMethod = p.method ?? 'CHECK';
    b.byMethod.set(method, (b.byMethod.get(method) ?? 0) + 1);
    b.vendors.add(normVendor(p.vendorName));
  }

  function methodRecord(m: Map<ApPaymentMethod, number>): Partial<Record<ApPaymentMethod, number>> {
    const out: Partial<Record<ApPaymentMethod, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotalPayments: prior.totalPayments,
    priorTotalCents: prior.totalCents,
    priorByMethod: methodRecord(prior.byMethod),
    priorDistinctVendors: prior.vendors.size,
    currentTotalPayments: current.totalPayments,
    currentTotalCents: current.totalCents,
    currentByMethod: methodRecord(current.byMethod),
    currentDistinctVendors: current.vendors.size,
    totalCentsDelta: current.totalCents - prior.totalCents,
    voidedSkipped,
  };
}
