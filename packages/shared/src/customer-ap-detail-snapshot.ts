// Customer-anchored per-job AP invoice detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: AP invoice count, distinct vendors,
// billed cents, paid cents, outstanding cents, last invoice
// date. Sorted by billed desc.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

export interface CustomerApDetailRow {
  jobId: string;
  invoiceCount: number;
  distinctVendors: number;
  billedCents: number;
  paidCents: number;
  outstandingCents: number;
  lastInvoiceDate: string | null;
}

export interface CustomerApDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerApDetailRow[];
}

export interface CustomerApDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

function canonVendor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,&'()]/g, ' ')
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCustomerApDetailSnapshot(
  inputs: CustomerApDetailSnapshotInputs,
): CustomerApDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    count: number;
    vendors: Set<string>;
    billed: number;
    paid: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { count: 0, vendors: new Set(), billed: 0, paid: 0, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const inv of inputs.apInvoices) {
    if (!inv.jobId || !customerJobs.has(inv.jobId)) continue;
    if (inv.invoiceDate > asOf) continue;
    if (inv.status === 'REJECTED') continue;
    const a = getAcc(inv.jobId);
    a.count += 1;
    a.vendors.add(canonVendor(inv.vendorName));
    a.billed += inv.totalCents;
    a.paid += inv.paidCents;
    if (a.lastDate == null || inv.invoiceDate > a.lastDate) a.lastDate = inv.invoiceDate;
  }

  const rows: CustomerApDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      invoiceCount: a.count,
      distinctVendors: a.vendors.size,
      billedCents: a.billed,
      paidCents: a.paid,
      outstandingCents: Math.max(0, a.billed - a.paid),
      lastInvoiceDate: a.lastDate,
    }))
    .sort((a, b) => b.billedCents - a.billedCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
