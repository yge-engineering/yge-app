// Job-anchored AP year-over-year.
//
// Plain English: for one job, collapse two years of AP
// invoices into a comparison: counts, billed cents, paid cents
// (ex voided), open cents, distinct vendors, plus deltas.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

export interface JobApYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorInvoices: number;
  priorBilledCents: number;
  priorPaidCents: number;
  priorOpenCents: number;
  priorDistinctVendors: number;
  currentInvoices: number;
  currentBilledCents: number;
  currentPaidCents: number;
  currentOpenCents: number;
  currentDistinctVendors: number;
  billedDelta: number;
}

export interface JobApYoyInputs {
  jobId: string;
  apInvoices: ApInvoice[];
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

export function buildJobApYoy(inputs: JobApYoyInputs): JobApYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    invoices: number;
    billed: number;
    paid: number;
    vendors: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { invoices: 0, billed: 0, paid: 0, vendors: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  const paidByInvoice = new Map<string, number>();
  for (const p of inputs.apPayments) {
    if (p.voided) continue;
    paidByInvoice.set(p.apInvoiceId, (paidByInvoice.get(p.apInvoiceId) ?? 0) + p.amountCents);
  }

  for (const inv of inputs.apInvoices) {
    if (inv.jobId !== inputs.jobId) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.invoices += 1;
    b.billed += inv.totalCents ?? 0;
    b.paid += paidByInvoice.get(inv.id) ?? 0;
    b.vendors.add(normVendor(inv.vendorName));
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorInvoices: prior.invoices,
    priorBilledCents: prior.billed,
    priorPaidCents: prior.paid,
    priorOpenCents: Math.max(0, prior.billed - prior.paid),
    priorDistinctVendors: prior.vendors.size,
    currentInvoices: current.invoices,
    currentBilledCents: current.billed,
    currentPaidCents: current.paid,
    currentOpenCents: Math.max(0, current.billed - current.paid),
    currentDistinctVendors: current.vendors.size,
    billedDelta: current.billed - prior.billed,
  };
}
