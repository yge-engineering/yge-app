// Customer-anchored per-job AR invoice detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency
// or AR invoice customerName), return one row per job: invoice
// count, billed cents, paid cents, outstanding cents, disputed
// count, written-off count, last invoice date. Sorted by
// outstanding desc.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

export interface CustomerArDetailRow {
  jobId: string;
  invoiceCount: number;
  billedCents: number;
  paidCents: number;
  outstandingCents: number;
  disputed: number;
  writtenOff: number;
  lastInvoiceDate: string | null;
}

export interface CustomerArDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerArDetailRow[];
}

export interface CustomerArDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  arInvoices: ArInvoice[];
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

export function buildCustomerArDetailSnapshot(
  inputs: CustomerArDetailSnapshotInputs,
): CustomerArDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  // Two ways to attribute an AR invoice to this customer:
  //   1) the invoice's jobId points to a job whose ownerAgency matches
  //   2) the invoice's customerName matches directly
  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    count: number;
    billed: number;
    paid: number;
    disputed: number;
    writtenOff: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { count: 0, billed: 0, paid: 0, disputed: 0, writtenOff: 0, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const inv of inputs.arInvoices) {
    const jobMatch = customerJobs.has(inv.jobId);
    const nameMatch = norm(inv.customerName) === target;
    if (!jobMatch && !nameMatch) continue;
    if (inv.invoiceDate > asOf) continue;
    const a = getAcc(inv.jobId);
    a.count += 1;
    a.billed += inv.totalCents;
    a.paid += inv.paidCents;
    if (inv.status === 'DISPUTED') a.disputed += 1;
    if (inv.status === 'WRITTEN_OFF') a.writtenOff += 1;
    if (a.lastDate == null || inv.invoiceDate > a.lastDate) a.lastDate = inv.invoiceDate;
  }

  const rows: CustomerArDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      invoiceCount: a.count,
      billedCents: a.billed,
      paidCents: a.paid,
      outstandingCents: Math.max(0, a.billed - a.paid),
      disputed: a.disputed,
      writtenOff: a.writtenOff,
      lastInvoiceDate: a.lastDate,
    }))
    .sort((a, b) => b.outstandingCents - a.outstandingCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
