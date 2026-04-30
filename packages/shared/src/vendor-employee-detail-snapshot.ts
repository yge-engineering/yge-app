// Vendor-anchored per-employee detail snapshot.
//
// Plain English: for one vendor (matched via canonicalized
// name), return one row per employee who expensed against the
// vendor with: receipt count, total cents, last receipt date.
// Sorted by total spend descending.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';

export interface VendorEmployeeDetailRow {
  employeeId: string;
  employeeName: string;
  receipts: number;
  totalCents: number;
  lastReceiptDate: string | null;
}

export interface VendorEmployeeDetailSnapshotResult {
  asOf: string;
  vendorName: string;
  rows: VendorEmployeeDetailRow[];
}

export interface VendorEmployeeDetailSnapshotInputs {
  vendorName: string;
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

export function buildVendorEmployeeDetailSnapshot(
  inputs: VendorEmployeeDetailSnapshotInputs,
): VendorEmployeeDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = normVendor(inputs.vendorName);

  type Acc = { name: string; receipts: number; cents: number; lastDate: string | null };
  const byEmp = new Map<string, Acc>();

  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    if (e.receiptDate > asOf) continue;
    const cur = byEmp.get(e.employeeId) ?? { name: e.employeeName, receipts: 0, cents: 0, lastDate: null };
    cur.receipts += 1;
    cur.cents += e.amountCents;
    if (cur.lastDate == null || e.receiptDate > cur.lastDate) cur.lastDate = e.receiptDate;
    byEmp.set(e.employeeId, cur);
  }

  const rows: VendorEmployeeDetailRow[] = [...byEmp.entries()]
    .map(([employeeId, a]) => ({
      employeeId,
      employeeName: a.name,
      receipts: a.receipts,
      totalCents: a.cents,
      lastReceiptDate: a.lastDate,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.employeeName.localeCompare(b.employeeName));

  return {
    asOf,
    vendorName: inputs.vendorName,
    rows,
  };
}
