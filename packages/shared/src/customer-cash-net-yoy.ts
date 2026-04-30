// Customer-anchored net cash year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of AR receipts (cash in) and AP
// disbursements tied to their jobs (cash out, ex voided) into
// a comparison: receipts, disbursements, net cents, plus
// deltas.
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

export interface CustomerCashNetYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorReceiptsCents: number;
  priorDisbursementsCents: number;
  priorNetCents: number;
  currentReceiptsCents: number;
  currentDisbursementsCents: number;
  currentNetCents: number;
  receiptsDelta: number;
  disbursementsDelta: number;
  netDelta: number;
}

export interface CustomerCashNetYoyInputs {
  customerName: string;
  arPayments: ArPayment[];
  arInvoices: ArInvoice[];
  apPayments: ApPayment[];
  jobs: Job[];
  apInvoiceJobByInvoiceId?: Record<string, string>;
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerCashNetYoy(
  inputs: CustomerCashNetYoyInputs,
): CustomerCashNetYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);
  const apMap = inputs.apInvoiceJobByInvoiceId ?? {};

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }
  const invoiceCustomer = new Map<string, string>();
  for (const inv of inputs.arInvoices) invoiceCustomer.set(inv.id, norm(inv.customerName));

  let priorR = 0;
  let priorD = 0;
  let currentR = 0;
  let currentD = 0;

  for (const p of inputs.arPayments) {
    const payerMatch = norm(p.payerName) === target;
    const invMatch = invoiceCustomer.get(p.arInvoiceId) === target;
    const jobMatch = customerJobs.has(p.jobId);
    if (!payerMatch && !invMatch && !jobMatch) continue;
    const year = Number(p.receivedOn.slice(0, 4));
    if (year === priorYear) priorR += p.amountCents;
    else if (year === inputs.currentYear) currentR += p.amountCents;
  }

  for (const p of inputs.apPayments) {
    if (p.voided) continue;
    const apJobId = apMap[p.apInvoiceId];
    if (apJobId == null || !customerJobs.has(apJobId)) continue;
    const year = Number(p.paidOn.slice(0, 4));
    if (year === priorYear) priorD += p.amountCents;
    else if (year === inputs.currentYear) currentD += p.amountCents;
  }

  const priorNet = priorR - priorD;
  const currentNet = currentR - currentD;

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorReceiptsCents: priorR,
    priorDisbursementsCents: priorD,
    priorNetCents: priorNet,
    currentReceiptsCents: currentR,
    currentDisbursementsCents: currentD,
    currentNetCents: currentNet,
    receiptsDelta: currentR - priorR,
    disbursementsDelta: currentD - priorD,
    netDelta: currentNet - priorNet,
  };
}
