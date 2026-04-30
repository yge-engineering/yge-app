// Portfolio AR receipts year-over-year.
//
// Plain English: collapse two years of AR payments into a
// comparison row with method mix + per-method dollar split +
// kind mix + distinct payers/jobs + delta.
//
// Different from portfolio-customer-payment-monthly (per
// month).
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentKind, ArPaymentMethod } from './ar-payment';

export interface PortfolioCustomerPaymentYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotalPayments: number;
  priorTotalCents: number;
  priorByMethod: Partial<Record<ArPaymentMethod, number>>;
  priorByKind: Partial<Record<ArPaymentKind, number>>;
  priorDistinctPayers: number;
  priorDistinctJobs: number;
  currentTotalPayments: number;
  currentTotalCents: number;
  currentByMethod: Partial<Record<ArPaymentMethod, number>>;
  currentByKind: Partial<Record<ArPaymentKind, number>>;
  currentDistinctPayers: number;
  currentDistinctJobs: number;
  totalCentsDelta: number;
}

export interface PortfolioCustomerPaymentYoyInputs {
  arPayments: ArPayment[];
  currentYear: number;
}

export function buildPortfolioCustomerPaymentYoy(
  inputs: PortfolioCustomerPaymentYoyInputs,
): PortfolioCustomerPaymentYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    totalPayments: number;
    totalCents: number;
    byMethod: Map<ArPaymentMethod, number>;
    byKind: Map<ArPaymentKind, number>;
    payers: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      totalPayments: 0,
      totalCents: 0,
      byMethod: new Map(),
      byKind: new Map(),
      payers: new Set(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.arPayments) {
    const year = Number(p.receivedOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.totalPayments += 1;
    b.totalCents += p.amountCents;
    const method: ArPaymentMethod = p.method ?? 'CHECK';
    b.byMethod.set(method, (b.byMethod.get(method) ?? 0) + 1);
    b.byKind.set(p.kind, (b.byKind.get(p.kind) ?? 0) + 1);
    if (p.payerName) b.payers.add(p.payerName.toLowerCase().trim());
    if (p.jobId) b.jobs.add(p.jobId);
  }

  function methodRecord(m: Map<ArPaymentMethod, number>): Partial<Record<ArPaymentMethod, number>> {
    const out: Partial<Record<ArPaymentMethod, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function kindRecord(m: Map<ArPaymentKind, number>): Partial<Record<ArPaymentKind, number>> {
    const out: Partial<Record<ArPaymentKind, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotalPayments: prior.totalPayments,
    priorTotalCents: prior.totalCents,
    priorByMethod: methodRecord(prior.byMethod),
    priorByKind: kindRecord(prior.byKind),
    priorDistinctPayers: prior.payers.size,
    priorDistinctJobs: prior.jobs.size,
    currentTotalPayments: current.totalPayments,
    currentTotalCents: current.totalCents,
    currentByMethod: methodRecord(current.byMethod),
    currentByKind: kindRecord(current.byKind),
    currentDistinctPayers: current.payers.size,
    currentDistinctJobs: current.jobs.size,
    totalCentsDelta: current.totalCents - prior.totalCents,
  };
}
