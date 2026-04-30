// Customer-anchored per-job detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, return one row per job with project name, status,
// AR billed/paid/open, AP billed, retention.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { Job, JobStatus } from './job';

export interface CustomerJobDetailRow {
  jobId: string;
  projectName: string;
  status: JobStatus;
  arBilledCents: number;
  arPaidCents: number;
  arOpenCents: number;
  arRetentionCents: number;
  apBilledCents: number;
}

export interface CustomerJobDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerJobDetailRow[];
}

export interface CustomerJobDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  apInvoices: ApInvoice[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerJobDetailSnapshot(
  inputs: CustomerJobDetailSnapshotInputs,
): CustomerJobDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = inputs.jobs.filter((j) => norm(j.ownerAgency) === target);
  const customerJobIds = new Set(customerJobs.map((j) => j.id));

  const arPaidByInvoice = new Map<string, number>();
  for (const p of inputs.arPayments) {
    if (p.receivedOn > asOf) continue;
    arPaidByInvoice.set(p.arInvoiceId, (arPaidByInvoice.get(p.arInvoiceId) ?? 0) + p.amountCents);
  }

  type Acc = {
    arBilled: number;
    arPaid: number;
    arRetention: number;
    apBilled: number;
  };
  const accByJob = new Map<string, Acc>();
  function getAcc(jid: string): Acc {
    let a = accByJob.get(jid);
    if (!a) {
      a = { arBilled: 0, arPaid: 0, arRetention: 0, apBilled: 0 };
      accByJob.set(jid, a);
    }
    return a;
  }

  for (const inv of inputs.arInvoices) {
    if (!customerJobIds.has(inv.jobId)) continue;
    if (inv.invoiceDate > asOf) continue;
    const a = getAcc(inv.jobId);
    a.arBilled += inv.totalCents ?? 0;
    a.arPaid += arPaidByInvoice.get(inv.id) ?? 0;
    a.arRetention += inv.retentionCents ?? 0;
  }
  for (const inv of inputs.apInvoices) {
    if (!inv.jobId || !customerJobIds.has(inv.jobId)) continue;
    if (inv.invoiceDate > asOf) continue;
    const a = getAcc(inv.jobId);
    a.apBilled += inv.totalCents ?? 0;
  }

  const rows: CustomerJobDetailRow[] = customerJobs
    .map((j) => {
      const a = accByJob.get(j.id) ?? { arBilled: 0, arPaid: 0, arRetention: 0, apBilled: 0 };
      return {
        jobId: j.id,
        projectName: j.projectName,
        status: j.status ?? 'PURSUING',
        arBilledCents: a.arBilled,
        arPaidCents: a.arPaid,
        arOpenCents: Math.max(0, a.arBilled - a.arPaid),
        arRetentionCents: a.arRetention,
        apBilledCents: a.apBilled,
      };
    })
    .sort((a, b) => b.arBilledCents - a.arBilledCents || a.projectName.localeCompare(b.projectName));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
