// Customer-anchored per-vendor detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per vendor that touched any of their jobs:
// AP-billed cents, expense-receipt cents, total spend.
// Sorted by total spend descending.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

export interface CustomerVendorDetailRow {
  vendorName: string;
  apBilledCents: number;
  expenseReceiptCents: number;
  totalSpendCents: number;
}

export interface CustomerVendorDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerVendorDetailRow[];
}

export interface CustomerVendorDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  apInvoices: ApInvoice[];
  expenses: Expense[];
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

export function buildCustomerVendorDetailSnapshot(
  inputs: CustomerVendorDetailSnapshotInputs,
): CustomerVendorDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = { display: string; ap: number; exp: number };
  const byVendor = new Map<string, Acc>();
  function getAcc(rawName: string): Acc {
    const key = normVendor(rawName);
    let a = byVendor.get(key);
    if (!a) {
      a = { display: rawName, ap: 0, exp: 0 };
      byVendor.set(key, a);
    }
    return a;
  }

  for (const inv of inputs.apInvoices) {
    if (!inv.jobId || !customerJobs.has(inv.jobId)) continue;
    if (inv.invoiceDate > asOf) continue;
    getAcc(inv.vendorName).ap += inv.totalCents ?? 0;
  }
  for (const e of inputs.expenses) {
    if (!e.jobId || !customerJobs.has(e.jobId)) continue;
    if (e.receiptDate > asOf) continue;
    getAcc(e.vendor).exp += e.amountCents;
  }

  const rows: CustomerVendorDetailRow[] = [...byVendor.values()]
    .map((a) => ({
      vendorName: a.display,
      apBilledCents: a.ap,
      expenseReceiptCents: a.exp,
      totalSpendCents: a.ap + a.exp,
    }))
    .sort((a, b) => b.totalSpendCents - a.totalSpendCents || a.vendorName.localeCompare(b.vendorName));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
