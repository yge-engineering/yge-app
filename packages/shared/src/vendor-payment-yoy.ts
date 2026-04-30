// Vendor-anchored AP payment year-over-year.
//
// Plain English: for one vendor (matched via canonicalized
// name), collapse two years of AP payments into a comparison:
// counts, total cents (ex voided), cleared cents, voided
// count, method mix, plus deltas.
//
// Pure derivation. No persisted records.

import type { ApPayment, ApPaymentMethod } from './ap-payment';

export interface VendorPaymentYoyResult {
  vendorName: string;
  priorYear: number;
  currentYear: number;
  priorPayments: number;
  priorCents: number;
  priorClearedCents: number;
  priorVoided: number;
  priorByMethod: Partial<Record<ApPaymentMethod, number>>;
  currentPayments: number;
  currentCents: number;
  currentClearedCents: number;
  currentVoided: number;
  currentByMethod: Partial<Record<ApPaymentMethod, number>>;
  centsDelta: number;
}

export interface VendorPaymentYoyInputs {
  vendorName: string;
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

export function buildVendorPaymentYoy(inputs: VendorPaymentYoyInputs): VendorPaymentYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = normVendor(inputs.vendorName);

  type Bucket = {
    payments: number;
    cents: number;
    cleared: number;
    voided: number;
    byMethod: Map<ApPaymentMethod, number>;
  };
  function emptyBucket(): Bucket {
    return { payments: 0, cents: 0, cleared: 0, voided: 0, byMethod: new Map() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.apPayments) {
    if (normVendor(p.vendorName) !== target) continue;
    const year = Number(p.paidOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    if (p.voided) {
      b.voided += 1;
      continue;
    }
    b.payments += 1;
    b.cents += p.amountCents;
    if (p.cleared) b.cleared += p.amountCents;
    b.byMethod.set(p.method, (b.byMethod.get(p.method) ?? 0) + 1);
  }

  function methodRecord(m: Map<ApPaymentMethod, number>): Partial<Record<ApPaymentMethod, number>> {
    const out: Partial<Record<ApPaymentMethod, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    vendorName: inputs.vendorName,
    priorYear,
    currentYear: inputs.currentYear,
    priorPayments: prior.payments,
    priorCents: prior.cents,
    priorClearedCents: prior.cleared,
    priorVoided: prior.voided,
    priorByMethod: methodRecord(prior.byMethod),
    currentPayments: current.payments,
    currentCents: current.cents,
    currentClearedCents: current.cleared,
    currentVoided: current.voided,
    currentByMethod: methodRecord(current.byMethod),
    centsDelta: current.cents - prior.cents,
  };
}
