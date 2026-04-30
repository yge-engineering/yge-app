// Customer-anchored AR receipt year-over-year.
//
// Plain English: for one customer (matched via payerName or
// invoice customer), collapse two years of AR payments into a
// comparison: counts, total cents, kind + method mix, distinct
// jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment, ArPaymentKind, ArPaymentMethod } from './ar-payment';

export interface CustomerPaymentYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorCents: number;
  priorByKind: Partial<Record<ArPaymentKind, number>>;
  priorByMethod: Partial<Record<ArPaymentMethod, number>>;
  priorDistinctJobs: number;
  currentTotal: number;
  currentCents: number;
  currentByKind: Partial<Record<ArPaymentKind, number>>;
  currentByMethod: Partial<Record<ArPaymentMethod, number>>;
  currentDistinctJobs: number;
  centsDelta: number;
}

export interface CustomerPaymentYoyInputs {
  customerName: string;
  arPayments: ArPayment[];
  arInvoices: ArInvoice[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerPaymentYoy(
  inputs: CustomerPaymentYoyInputs,
): CustomerPaymentYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const invoiceCustomer = new Map<string, string>();
  for (const inv of inputs.arInvoices) invoiceCustomer.set(inv.id, norm(inv.customerName));

  type Bucket = {
    total: number;
    cents: number;
    byKind: Map<ArPaymentKind, number>;
    byMethod: Map<ArPaymentMethod, number>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, cents: 0, byKind: new Map(), byMethod: new Map(), jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.arPayments) {
    const payerMatch = norm(p.payerName) === target;
    const invMatch = invoiceCustomer.get(p.arInvoiceId) === target;
    if (!payerMatch && !invMatch) continue;
    const year = Number(p.receivedOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.cents += p.amountCents;
    b.byKind.set(p.kind, (b.byKind.get(p.kind) ?? 0) + 1);
    b.byMethod.set(p.method, (b.byMethod.get(p.method) ?? 0) + 1);
    b.jobs.add(p.jobId);
  }

  function kindRecord(m: Map<ArPaymentKind, number>): Partial<Record<ArPaymentKind, number>> {
    const out: Partial<Record<ArPaymentKind, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function methodRecord(m: Map<ArPaymentMethod, number>): Partial<Record<ArPaymentMethod, number>> {
    const out: Partial<Record<ArPaymentMethod, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorCents: prior.cents,
    priorByKind: kindRecord(prior.byKind),
    priorByMethod: methodRecord(prior.byMethod),
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentCents: current.cents,
    currentByKind: kindRecord(current.byKind),
    currentByMethod: methodRecord(current.byMethod),
    currentDistinctJobs: current.jobs.size,
    centsDelta: current.cents - prior.cents,
  };
}
