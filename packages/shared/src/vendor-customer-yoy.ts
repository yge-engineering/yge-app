// Vendor-anchored customer footprint year-over-year.
//
// Plain English: for one vendor, collapse two years of AP +
// expense activity by the customer (Job.ownerAgency) of the
// jobs it billed against: distinct customers per year, total
// spend, plus deltas.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

export interface VendorCustomerYoyResult {
  vendorName: string;
  priorYear: number;
  currentYear: number;
  priorDistinctCustomers: number;
  priorTotalSpendCents: number;
  currentDistinctCustomers: number;
  currentTotalSpendCents: number;
  customersDelta: number;
  totalSpendDelta: number;
}

export interface VendorCustomerYoyInputs {
  vendorName: string;
  apInvoices: ApInvoice[];
  expenses: Expense[];
  jobs: Job[];
  currentYear: number;
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

export function buildVendorCustomerYoy(inputs: VendorCustomerYoyInputs): VendorCustomerYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = normVendor(inputs.vendorName);

  const jobOwner = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) jobOwner.set(j.id, norm(j.ownerAgency));
  }

  type Bucket = { customers: Set<string>; cents: number };
  function emptyBucket(): Bucket {
    return { customers: new Set(), cents: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const inv of inputs.apInvoices) {
    if (normVendor(inv.vendorName) !== target) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.cents += inv.totalCents ?? 0;
    if (inv.jobId) {
      const owner = jobOwner.get(inv.jobId);
      if (owner) b.customers.add(owner);
    }
  }
  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    const year = Number(e.receiptDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.cents += e.amountCents;
    if (e.jobId) {
      const owner = jobOwner.get(e.jobId);
      if (owner) b.customers.add(owner);
    }
  }

  return {
    vendorName: inputs.vendorName,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctCustomers: prior.customers.size,
    priorTotalSpendCents: prior.cents,
    currentDistinctCustomers: current.customers.size,
    currentTotalSpendCents: current.cents,
    customersDelta: current.customers.size - prior.customers.size,
    totalSpendDelta: current.cents - prior.cents,
  };
}
