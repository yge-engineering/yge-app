// Customer-anchored vendor snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count distinct vendors who showed up in AP
// invoices or expenses on any of their jobs. Sum total spend.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

export interface CustomerVendorSnapshotResult {
  asOf: string;
  customerName: string;
  distinctVendors: number;
  apVendorCount: number;
  expenseVendorCount: number;
  apBilledCents: number;
  expenseReceiptCents: number;
  totalSpendCents: number;
  distinctJobs: number;
}

export interface CustomerVendorSnapshotInputs {
  customerName: string;
  apInvoices: ApInvoice[];
  expenses: Expense[];
  jobs: Job[];
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

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCustomerVendorSnapshot(
  inputs: CustomerVendorSnapshotInputs,
): CustomerVendorSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const apVendors = new Set<string>();
  const expenseVendors = new Set<string>();
  const jobs = new Set<string>();
  let apBilledCents = 0;
  let expenseReceiptCents = 0;

  for (const inv of inputs.apInvoices) {
    if (!inv.jobId || !customerJobs.has(inv.jobId)) continue;
    if (inv.invoiceDate > asOf) continue;
    apVendors.add(normVendor(inv.vendorName));
    apBilledCents += inv.totalCents ?? 0;
    jobs.add(inv.jobId);
  }
  for (const e of inputs.expenses) {
    if (!e.jobId || !customerJobs.has(e.jobId)) continue;
    if (e.receiptDate > asOf) continue;
    expenseVendors.add(normVendor(e.vendor));
    expenseReceiptCents += e.amountCents;
    jobs.add(e.jobId);
  }

  const allVendors = new Set<string>([...apVendors, ...expenseVendors]);

  return {
    asOf,
    customerName: inputs.customerName,
    distinctVendors: allVendors.size,
    apVendorCount: apVendors.size,
    expenseVendorCount: expenseVendors.size,
    apBilledCents,
    expenseReceiptCents,
    totalSpendCents: apBilledCents + expenseReceiptCents,
    distinctJobs: jobs.size,
  };
}
