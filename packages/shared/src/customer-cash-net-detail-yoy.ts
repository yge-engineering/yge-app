// Customer-anchored per-job cash-net year-over-year detail.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job touched in either year with the
// receipts, disbursements (ex voided), and net for each year
// plus the year-over-year deltas. Sorted by absolute net
// delta so the biggest movers come first.
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

export interface CustomerCashNetDetailYoyRow {
  jobId: string;
  priorReceiptsCents: number;
  priorDisbursementsCents: number;
  priorNetCents: number;
  currentReceiptsCents: number;
  currentDisbursementsCents: number;
  currentNetCents: number;
  netDelta: number;
}

export interface CustomerCashNetDetailYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  rows: CustomerCashNetDetailYoyRow[];
}

export interface CustomerCashNetDetailYoyInputs {
  customerName: string;
  jobs: Job[];
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  apInvoiceJobByInvoiceId?: Record<string, string>;
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerCashNetDetailYoy(
  inputs: CustomerCashNetDetailYoyInputs,
): CustomerCashNetDetailYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);
  const apMap = inputs.apInvoiceJobByInvoiceId ?? {};

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    priorR: number;
    priorD: number;
    currentR: number;
    currentD: number;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { priorR: 0, priorD: 0, currentR: 0, currentD: 0 };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const p of inputs.arPayments) {
    if (!customerJobs.has(p.jobId)) continue;
    const year = Number(p.receivedOn.slice(0, 4));
    if (year === priorYear) getAcc(p.jobId).priorR += p.amountCents;
    else if (year === inputs.currentYear) getAcc(p.jobId).currentR += p.amountCents;
  }
  for (const p of inputs.apPayments) {
    if (p.voided) continue;
    const apJobId = apMap[p.apInvoiceId];
    if (apJobId == null || !customerJobs.has(apJobId)) continue;
    const year = Number(p.paidOn.slice(0, 4));
    if (year === priorYear) getAcc(apJobId).priorD += p.amountCents;
    else if (year === inputs.currentYear) getAcc(apJobId).currentD += p.amountCents;
  }

  const rows: CustomerCashNetDetailYoyRow[] = [...byJob.entries()]
    .map(([jobId, a]) => {
      const priorNet = a.priorR - a.priorD;
      const currentNet = a.currentR - a.currentD;
      return {
        jobId,
        priorReceiptsCents: a.priorR,
        priorDisbursementsCents: a.priorD,
        priorNetCents: priorNet,
        currentReceiptsCents: a.currentR,
        currentDisbursementsCents: a.currentD,
        currentNetCents: currentNet,
        netDelta: currentNet - priorNet,
      };
    })
    .sort((a, b) => Math.abs(b.netDelta) - Math.abs(a.netDelta) || a.jobId.localeCompare(b.jobId));

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    rows,
  };
}
