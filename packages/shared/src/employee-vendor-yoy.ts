// Employee-anchored vendor footprint year-over-year.
//
// Plain English: for one employee, collapse two years of
// expense receipts into a comparison: distinct vendors per
// year, receipts + cents, plus deltas.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';

export interface EmployeeVendorYoyResult {
  employeeId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctVendors: number;
  priorReceipts: number;
  priorCents: number;
  currentDistinctVendors: number;
  currentReceipts: number;
  currentCents: number;
  vendorsDelta: number;
  centsDelta: number;
}

export interface EmployeeVendorYoyInputs {
  employeeId: string;
  expenses: Expense[];
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

export function buildEmployeeVendorYoy(inputs: EmployeeVendorYoyInputs): EmployeeVendorYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = { vendors: Set<string>; receipts: number; cents: number };
  function emptyBucket(): Bucket {
    return { vendors: new Set(), receipts: 0, cents: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const e of inputs.expenses) {
    if (e.employeeId !== inputs.employeeId) continue;
    const year = Number(e.receiptDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.vendors.add(normVendor(e.vendor));
    b.receipts += 1;
    b.cents += e.amountCents;
  }

  return {
    employeeId: inputs.employeeId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctVendors: prior.vendors.size,
    priorReceipts: prior.receipts,
    priorCents: prior.cents,
    currentDistinctVendors: current.vendors.size,
    currentReceipts: current.receipts,
    currentCents: current.cents,
    vendorsDelta: current.vendors.size - prior.vendors.size,
    centsDelta: current.cents - prior.cents,
  };
}
