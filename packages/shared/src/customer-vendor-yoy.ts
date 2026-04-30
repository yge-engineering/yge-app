// Customer-anchored vendor footprint year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of AP + expense activity on their jobs
// into a comparison: distinct vendors per rail and combined,
// total spend, plus deltas.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

export interface CustomerVendorYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorDistinctVendors: number;
  priorTotalSpendCents: number;
  currentDistinctVendors: number;
  currentTotalSpendCents: number;
  vendorsDelta: number;
  totalSpendDelta: number;
}

export interface CustomerVendorYoyInputs {
  customerName: string;
  apInvoices: ApInvoice[];
  expenses: Expense[];
  jobs: Job[];
  currentYear: number;
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

export function buildCustomerVendorYoy(inputs: CustomerVendorYoyInputs): CustomerVendorYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = { vendors: Set<string>; cents: number };
  function emptyBucket(): Bucket {
    return { vendors: new Set(), cents: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const inv of inputs.apInvoices) {
    if (!inv.jobId || !customerJobs.has(inv.jobId)) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.vendors.add(normVendor(inv.vendorName));
    b.cents += inv.totalCents ?? 0;
  }
  for (const e of inputs.expenses) {
    if (!e.jobId || !customerJobs.has(e.jobId)) continue;
    const year = Number(e.receiptDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.vendors.add(normVendor(e.vendor));
    b.cents += e.amountCents;
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctVendors: prior.vendors.size,
    priorTotalSpendCents: prior.cents,
    currentDistinctVendors: current.vendors.size,
    currentTotalSpendCents: current.cents,
    vendorsDelta: current.vendors.size - prior.vendors.size,
    totalSpendDelta: current.cents - prior.cents,
  };
}
