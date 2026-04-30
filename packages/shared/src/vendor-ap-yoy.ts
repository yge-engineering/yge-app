// Vendor-anchored AP year-over-year.
//
// Plain English: for one vendor (matched via canonicalized
// name), collapse two years of AP invoices into a comparison:
// invoice count, billed cents, paid cents (ex voided), open
// cents, distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

export interface VendorApYoyResult {
  vendorName: string;
  priorYear: number;
  currentYear: number;
  priorInvoices: number;
  priorBilledCents: number;
  priorPaidCents: number;
  priorOpenCents: number;
  priorDistinctJobs: number;
  currentInvoices: number;
  currentBilledCents: number;
  currentPaidCents: number;
  currentOpenCents: number;
  currentDistinctJobs: number;
  billedDelta: number;
}

export interface VendorApYoyInputs {
  vendorName: string;
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

export function buildVendorApYoy(inputs: VendorApYoyInputs): VendorApYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = normVendor(inputs.vendorName);

  type Bucket = { invoices: number; billed: number; paid: number; jobs: Set<string> };
  function emptyBucket(): Bucket {
    return { invoices: 0, billed: 0, paid: 0, jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  // index payments by invoice
  const paidByInvoice = new Map<string, number>();
  for (const p of inputs.apPayments) {
    if (p.voided) continue;
    paidByInvoice.set(p.apInvoiceId, (paidByInvoice.get(p.apInvoiceId) ?? 0) + p.amountCents);
  }

  for (const inv of inputs.apInvoices) {
    if (normVendor(inv.vendorName) !== target) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.invoices += 1;
    b.billed += inv.totalCents ?? 0;
    b.paid += paidByInvoice.get(inv.id) ?? 0;
    if (inv.jobId) b.jobs.add(inv.jobId);
  }

  return {
    vendorName: inputs.vendorName,
    priorYear,
    currentYear: inputs.currentYear,
    priorInvoices: prior.invoices,
    priorBilledCents: prior.billed,
    priorPaidCents: prior.paid,
    priorOpenCents: Math.max(0, prior.billed - prior.paid),
    priorDistinctJobs: prior.jobs.size,
    currentInvoices: current.invoices,
    currentBilledCents: current.billed,
    currentPaidCents: current.paid,
    currentOpenCents: Math.max(0, current.billed - current.paid),
    currentDistinctJobs: current.jobs.size,
    billedDelta: current.billed - prior.billed,
  };
}
