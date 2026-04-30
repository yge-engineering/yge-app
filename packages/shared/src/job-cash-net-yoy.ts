// Job-anchored net-cash year-over-year.
//
// Plain English: for one job, collapse two years of AR
// receipts and AP disbursements (ex voided) into a comparison:
// receipts, disbursements, net cents, plus deltas.
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

export interface JobCashNetYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorReceiptsCents: number;
  priorDisbursementsCents: number;
  priorNetCents: number;
  currentReceiptsCents: number;
  currentDisbursementsCents: number;
  currentNetCents: number;
  netDelta: number;
}

export interface JobCashNetYoyInputs {
  jobId: string;
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  apInvoiceJobByInvoiceId?: Record<string, string>;
  currentYear: number;
}

export function buildJobCashNetYoy(inputs: JobCashNetYoyInputs): JobCashNetYoyResult {
  const priorYear = inputs.currentYear - 1;
  const apMap = inputs.apInvoiceJobByInvoiceId ?? {};

  let priorR = 0;
  let priorD = 0;
  let currentR = 0;
  let currentD = 0;

  for (const p of inputs.arPayments) {
    if (p.jobId !== inputs.jobId) continue;
    const year = Number(p.receivedOn.slice(0, 4));
    if (year === priorYear) priorR += p.amountCents;
    else if (year === inputs.currentYear) currentR += p.amountCents;
  }
  for (const p of inputs.apPayments) {
    if (p.voided) continue;
    const apJobId = apMap[p.apInvoiceId];
    if (apJobId !== inputs.jobId) continue;
    const year = Number(p.paidOn.slice(0, 4));
    if (year === priorYear) priorD += p.amountCents;
    else if (year === inputs.currentYear) currentD += p.amountCents;
  }

  const priorNet = priorR - priorD;
  const currentNet = currentR - currentD;

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorReceiptsCents: priorR,
    priorDisbursementsCents: priorD,
    priorNetCents: priorNet,
    currentReceiptsCents: currentR,
    currentDisbursementsCents: currentD,
    currentNetCents: currentNet,
    netDelta: currentNet - priorNet,
  };
}
