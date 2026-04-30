// Job-anchored AR year-over-year.
//
// Plain English: for one job, collapse two years of AR
// invoices into a comparison: counts, billed cents, paid cents,
// retention cents, plus deltas.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface JobArYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorInvoices: number;
  priorBilledCents: number;
  priorPaidCents: number;
  priorRetentionCents: number;
  priorOpenCents: number;
  currentInvoices: number;
  currentBilledCents: number;
  currentPaidCents: number;
  currentRetentionCents: number;
  currentOpenCents: number;
  billedDelta: number;
}

export interface JobArYoyInputs {
  jobId: string;
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  currentYear: number;
}

export function buildJobArYoy(inputs: JobArYoyInputs): JobArYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    invoices: number;
    billed: number;
    paid: number;
    retention: number;
  };
  function emptyBucket(): Bucket {
    return { invoices: 0, billed: 0, paid: 0, retention: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  const paidByInvoice = new Map<string, number>();
  for (const p of inputs.arPayments) {
    paidByInvoice.set(p.arInvoiceId, (paidByInvoice.get(p.arInvoiceId) ?? 0) + p.amountCents);
  }

  for (const inv of inputs.arInvoices) {
    if (inv.jobId !== inputs.jobId) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.invoices += 1;
    b.billed += inv.totalCents ?? 0;
    b.paid += paidByInvoice.get(inv.id) ?? 0;
    b.retention += inv.retentionCents ?? 0;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorInvoices: prior.invoices,
    priorBilledCents: prior.billed,
    priorPaidCents: prior.paid,
    priorRetentionCents: prior.retention,
    priorOpenCents: Math.max(0, prior.billed - prior.paid),
    currentInvoices: current.invoices,
    currentBilledCents: current.billed,
    currentPaidCents: current.paid,
    currentRetentionCents: current.retention,
    currentOpenCents: Math.max(0, current.billed - current.paid),
    billedDelta: current.billed - prior.billed,
  };
}
