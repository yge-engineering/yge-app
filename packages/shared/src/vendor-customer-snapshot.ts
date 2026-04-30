// Vendor-anchored customer snapshot.
//
// Plain English: for one vendor (matched via canonicalized
// name), as-of today, surface which YGE customers' jobs the
// vendor has billed against (AP) or been expensed at — i.e.
// "Granite has touched Caltrans, Tehama County, and YGE
// private". Counts distinct customers + jobs + total spend
// across both rails.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

export interface VendorCustomerSnapshotResult {
  asOf: string;
  vendorName: string;
  distinctCustomers: number;
  distinctJobs: number;
  apBilledCents: number;
  expenseReceiptCents: number;
  totalSpendCents: number;
}

export interface VendorCustomerSnapshotInputs {
  vendorName: string;
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

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildVendorCustomerSnapshot(
  inputs: VendorCustomerSnapshotInputs,
): VendorCustomerSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = normVendor(inputs.vendorName);

  const jobOwner = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) jobOwner.set(j.id, norm(j.ownerAgency));
  }

  const customers = new Set<string>();
  const jobs = new Set<string>();
  let apBilledCents = 0;
  let expenseReceiptCents = 0;

  for (const inv of inputs.apInvoices) {
    if (normVendor(inv.vendorName) !== target) continue;
    if (inv.invoiceDate > asOf) continue;
    apBilledCents += inv.totalCents ?? 0;
    if (inv.jobId) {
      jobs.add(inv.jobId);
      const owner = jobOwner.get(inv.jobId);
      if (owner) customers.add(owner);
    }
  }
  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    if (e.receiptDate > asOf) continue;
    expenseReceiptCents += e.amountCents;
    if (e.jobId) {
      jobs.add(e.jobId);
      const owner = jobOwner.get(e.jobId);
      if (owner) customers.add(owner);
    }
  }

  return {
    asOf,
    vendorName: inputs.vendorName,
    distinctCustomers: customers.size,
    distinctJobs: jobs.size,
    apBilledCents,
    expenseReceiptCents,
    totalSpendCents: apBilledCents + expenseReceiptCents,
  };
}
