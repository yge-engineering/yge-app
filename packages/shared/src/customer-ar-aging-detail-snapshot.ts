// Customer-anchored per-job AR aging detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job with their unpaid AR rolled into 0-30,
// 31-60, 61-90, 91+ day buckets based on invoiceDate vs asOf.
// Disputed and written-off invoices are excluded from buckets.
// Sorted by total outstanding desc.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

export interface CustomerArAgingDetailRow {
  jobId: string;
  bucket0to30Cents: number;
  bucket31to60Cents: number;
  bucket61to90Cents: number;
  bucket91plusCents: number;
  totalOutstandingCents: number;
  invoiceCount: number;
}

export interface CustomerArAgingDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerArAgingDetailRow[];
}

export interface CustomerArAgingDetailSnapshotInputs {
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

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function buildCustomerArAgingDetailSnapshot(
  inputs: CustomerArAgingDetailSnapshotInputs,
): CustomerArAgingDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    b0to30: number;
    b31to60: number;
    b61to90: number;
    b91plus: number;
    total: number;
    count: number;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { b0to30: 0, b31to60: 0, b61to90: 0, b91plus: 0, total: 0, count: 0 };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const inv of inputs.arInvoices) {
    const jobMatch = customerJobs.has(inv.jobId);
    const nameMatch = norm(inv.customerName) === target;
    if (!jobMatch && !nameMatch) continue;
    if (inv.invoiceDate > asOf) continue;
    if (inv.status === 'WRITTEN_OFF' || inv.status === 'DISPUTED' || inv.status === 'PAID') continue;
    const outstanding = Math.max(0, inv.totalCents - inv.paidCents);
    if (outstanding === 0) continue;
    const a = getAcc(inv.jobId);
    a.count += 1;
    a.total += outstanding;
    const age = daysBetween(inv.invoiceDate, asOf);
    if (age <= 30) a.b0to30 += outstanding;
    else if (age <= 60) a.b31to60 += outstanding;
    else if (age <= 90) a.b61to90 += outstanding;
    else a.b91plus += outstanding;
  }

  const rows: CustomerArAgingDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      bucket0to30Cents: a.b0to30,
      bucket31to60Cents: a.b31to60,
      bucket61to90Cents: a.b61to90,
      bucket91plusCents: a.b91plus,
      totalOutstandingCents: a.total,
      invoiceCount: a.count,
    }))
    .sort((a, b) => b.totalOutstandingCents - a.totalOutstandingCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
