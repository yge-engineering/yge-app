// Vendor-anchored employee footprint year-over-year.
//
// Plain English: for one vendor (matched via canonicalized
// name), collapse two years of expense receipts into a
// comparison: distinct employees per year, total receipts +
// cents, plus deltas.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';

export interface VendorEmployeeYoyResult {
  vendorName: string;
  priorYear: number;
  currentYear: number;
  priorDistinctEmployees: number;
  priorReceipts: number;
  priorCents: number;
  currentDistinctEmployees: number;
  currentReceipts: number;
  currentCents: number;
  employeesDelta: number;
  centsDelta: number;
}

export interface VendorEmployeeYoyInputs {
  vendorName: string;
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

export function buildVendorEmployeeYoy(inputs: VendorEmployeeYoyInputs): VendorEmployeeYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = normVendor(inputs.vendorName);

  type Bucket = { employees: Set<string>; receipts: number; cents: number };
  function emptyBucket(): Bucket {
    return { employees: new Set(), receipts: 0, cents: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    const year = Number(e.receiptDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.employees.add(e.employeeId);
    b.receipts += 1;
    b.cents += e.amountCents;
  }

  return {
    vendorName: inputs.vendorName,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctEmployees: prior.employees.size,
    priorReceipts: prior.receipts,
    priorCents: prior.cents,
    currentDistinctEmployees: current.employees.size,
    currentReceipts: current.receipts,
    currentCents: current.cents,
    employeesDelta: current.employees.size - prior.employees.size,
    centsDelta: current.cents - prior.cents,
  };
}
