// Per-job cash net flow.
//
// Plain English: per AWARDED job, AR payments received (cash IN)
// vs AP payments made (cash OUT). The difference is the job's
// net cash position to date. Negative = job is using company
// cash to fund itself; positive = job is funding the rest of
// the operation.
//
// AR payments carry jobId directly. AP payments don't — they
// link via apInvoiceId, which is why this module takes the AP
// invoice list as input to resolve each payment back to its job.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

export interface JobCashNetRow {
  jobId: string;
  projectName: string;
  cashInCents: number;
  arPaymentCount: number;
  cashOutCents: number;
  apPaymentCount: number;
  netCents: number;
}

export interface JobCashNetRollup {
  jobsConsidered: number;
  totalCashInCents: number;
  totalCashOutCents: number;
  totalNetCents: number;
  /** Jobs where cashOut > cashIn — currently funded by company cash. */
  netNegativeJobs: number;
}

export interface JobCashNetInputs {
  /** Optional yyyy-mm-dd window applied per payment date. */
  fromDate?: string;
  toDate?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  /** AP invoices — needed to map AP payments back to a jobId via
   *  apInvoiceId, since ApPayment doesn't carry jobId directly. */
  apInvoices: ApInvoice[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobCashNet(inputs: JobCashNetInputs): {
  rollup: JobCashNetRollup;
  rows: JobCashNetRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  // Build apInvoice → jobId lookup so AP payments can be routed.
  const jobByApInvoice = new Map<string, string>();
  for (const inv of inputs.apInvoices) {
    if (inv.jobId) jobByApInvoice.set(inv.id, inv.jobId);
  }

  // AR cash in per job.
  const cashInByJob = new Map<string, number>();
  const arCountByJob = new Map<string, number>();
  for (const p of inputs.arPayments) {
    if (!inRange(p.receivedOn)) continue;
    cashInByJob.set(p.jobId, (cashInByJob.get(p.jobId) ?? 0) + p.amountCents);
    arCountByJob.set(p.jobId, (arCountByJob.get(p.jobId) ?? 0) + 1);
  }

  // AP cash out per job.
  const cashOutByJob = new Map<string, number>();
  const apCountByJob = new Map<string, number>();
  for (const p of inputs.apPayments) {
    if (!inRange(p.paidOn)) continue;
    const jobId = jobByApInvoice.get(p.apInvoiceId);
    if (!jobId) continue; // payment for an invoice with no job link
    cashOutByJob.set(jobId, (cashOutByJob.get(jobId) ?? 0) + p.amountCents);
    apCountByJob.set(jobId, (apCountByJob.get(jobId) ?? 0) + 1);
  }

  const rows: JobCashNetRow[] = [];
  let totalIn = 0;
  let totalOut = 0;
  let netNegative = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const cashIn = cashInByJob.get(j.id) ?? 0;
    const cashOut = cashOutByJob.get(j.id) ?? 0;
    const net = cashIn - cashOut;
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      cashInCents: cashIn,
      arPaymentCount: arCountByJob.get(j.id) ?? 0,
      cashOutCents: cashOut,
      apPaymentCount: apCountByJob.get(j.id) ?? 0,
      netCents: net,
    });
    totalIn += cashIn;
    totalOut += cashOut;
    if (net < 0) netNegative += 1;
  }

  // Most-negative net first (jobs eating company cash), then by
  // decreasing surplus.
  rows.sort((a, b) => a.netCents - b.netCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalCashInCents: totalIn,
      totalCashOutCents: totalOut,
      totalNetCents: totalIn - totalOut,
      netNegativeJobs: netNegative,
    },
    rows,
  };
}
