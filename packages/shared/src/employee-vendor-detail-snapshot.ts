// Employee-anchored per-vendor detail snapshot.
//
// Plain English: for one employee, return one row per vendor
// they expensed against with receipts + total cents + last
// receipt date, sorted by spend descending.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';

export interface EmployeeVendorDetailRow {
  vendorName: string;
  receipts: number;
  totalCents: number;
  lastReceiptDate: string | null;
}

export interface EmployeeVendorDetailSnapshotResult {
  asOf: string;
  employeeId: string;
  rows: EmployeeVendorDetailRow[];
}

export interface EmployeeVendorDetailSnapshotInputs {
  employeeId: string;
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

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildEmployeeVendorDetailSnapshot(
  inputs: EmployeeVendorDetailSnapshotInputs,
): EmployeeVendorDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = { display: string; receipts: number; cents: number; lastDate: string | null };
  const byVendor = new Map<string, Acc>();

  for (const e of inputs.expenses) {
    if (e.employeeId !== inputs.employeeId) continue;
    if (e.receiptDate > asOf) continue;
    const key = normVendor(e.vendor);
    const cur = byVendor.get(key) ?? { display: e.vendor, receipts: 0, cents: 0, lastDate: null };
    cur.receipts += 1;
    cur.cents += e.amountCents;
    if (cur.lastDate == null || e.receiptDate > cur.lastDate) cur.lastDate = e.receiptDate;
    byVendor.set(key, cur);
  }

  const rows: EmployeeVendorDetailRow[] = [...byVendor.values()]
    .map((v) => ({
      vendorName: v.display,
      receipts: v.receipts,
      totalCents: v.cents,
      lastReceiptDate: v.lastDate,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.vendorName.localeCompare(b.vendorName));

  return {
    asOf,
    employeeId: inputs.employeeId,
    rows,
  };
}
