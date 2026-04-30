// Employee-anchored vendor footprint snapshot.
//
// Plain English: for one employee, as-of today, surface which
// vendors they expensed against. Counts distinct vendors, top-N
// vendors by receipt count, total receipts + cents.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';

export interface EmployeeVendorRow {
  vendorName: string;
  receipts: number;
  totalCents: number;
}

export interface EmployeeVendorSnapshotResult {
  asOf: string;
  employeeId: string;
  distinctVendors: number;
  totalReceipts: number;
  totalCents: number;
  topVendors: EmployeeVendorRow[];
}

export interface EmployeeVendorSnapshotInputs {
  employeeId: string;
  expenses: Expense[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Top-N vendors by receipt count. Default 5. */
  topN?: number;
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

export function buildEmployeeVendorSnapshot(inputs: EmployeeVendorSnapshotInputs): EmployeeVendorSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const topN = inputs.topN ?? 5;

  const byVendor = new Map<string, { display: string; receipts: number; cents: number }>();
  let totalReceipts = 0;
  let totalCents = 0;

  for (const e of inputs.expenses) {
    if (e.employeeId !== inputs.employeeId) continue;
    if (e.receiptDate > asOf) continue;
    totalReceipts += 1;
    totalCents += e.amountCents;
    const key = normVendor(e.vendor);
    const cur = byVendor.get(key) ?? { display: e.vendor, receipts: 0, cents: 0 };
    cur.receipts += 1;
    cur.cents += e.amountCents;
    byVendor.set(key, cur);
  }

  const sorted = [...byVendor.values()]
    .map((v) => ({ vendorName: v.display, receipts: v.receipts, totalCents: v.cents }))
    .sort((a, b) => b.receipts - a.receipts || b.totalCents - a.totalCents);

  return {
    asOf,
    employeeId: inputs.employeeId,
    distinctVendors: byVendor.size,
    totalReceipts,
    totalCents,
    topVendors: sorted.slice(0, topN),
  };
}
