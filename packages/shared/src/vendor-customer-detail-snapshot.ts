// Vendor-anchored per-customer detail snapshot.
//
// Plain English: for one vendor (matched via canonicalized
// name), return one row per customer (job-owner agency) the
// vendor has touched: AP-billed cents, expense-receipt cents,
// total spend, distinct jobs. Sorted by total spend descending.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

export interface VendorCustomerDetailRow {
  customerName: string;
  apBilledCents: number;
  expenseReceiptCents: number;
  totalSpendCents: number;
  distinctJobs: number;
}

export interface VendorCustomerDetailSnapshotResult {
  asOf: string;
  vendorName: string;
  rows: VendorCustomerDetailRow[];
}

export interface VendorCustomerDetailSnapshotInputs {
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

export function buildVendorCustomerDetailSnapshot(
  inputs: VendorCustomerDetailSnapshotInputs,
): VendorCustomerDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = normVendor(inputs.vendorName);

  const jobOwner = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) jobOwner.set(j.id, j.ownerAgency);
  }

  type Acc = { ap: number; exp: number; jobs: Set<string> };
  const byCustomer = new Map<string, Acc>();
  function getAcc(customerName: string): Acc {
    let a = byCustomer.get(customerName);
    if (!a) {
      a = { ap: 0, exp: 0, jobs: new Set() };
      byCustomer.set(customerName, a);
    }
    return a;
  }

  for (const inv of inputs.apInvoices) {
    if (normVendor(inv.vendorName) !== target) continue;
    if (inv.invoiceDate > asOf) continue;
    if (!inv.jobId) continue;
    const owner = jobOwner.get(inv.jobId);
    if (!owner) continue;
    const a = getAcc(owner);
    a.ap += inv.totalCents ?? 0;
    a.jobs.add(inv.jobId);
  }
  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    if (e.receiptDate > asOf) continue;
    if (!e.jobId) continue;
    const owner = jobOwner.get(e.jobId);
    if (!owner) continue;
    const a = getAcc(owner);
    a.exp += e.amountCents;
    a.jobs.add(e.jobId);
  }

  const rows: VendorCustomerDetailRow[] = [...byCustomer.entries()]
    .map(([customerName, a]) => ({
      customerName,
      apBilledCents: a.ap,
      expenseReceiptCents: a.exp,
      totalSpendCents: a.ap + a.exp,
      distinctJobs: a.jobs.size,
    }))
    .sort((a, b) => b.totalSpendCents - a.totalSpendCents || a.customerName.localeCompare(b.customerName));

  return {
    asOf,
    vendorName: inputs.vendorName,
    rows,
  };
}
