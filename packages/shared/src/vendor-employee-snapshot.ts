// Vendor-anchored employee footprint snapshot.
//
// Plain English: for one vendor (matched via canonicalized
// name), as-of today, surface which employees expensed against
// the vendor. Counts distinct employees, top-N employees by
// receipt count, total receipts.
//
// Pure derivation. No persisted records.

import type { Expense } from './expense';

export interface VendorEmployeeRow {
  employeeId: string;
  employeeName: string;
  receipts: number;
  totalCents: number;
}

export interface VendorEmployeeSnapshotResult {
  asOf: string;
  vendorName: string;
  distinctEmployees: number;
  totalReceipts: number;
  totalCents: number;
  topEmployees: VendorEmployeeRow[];
}

export interface VendorEmployeeSnapshotInputs {
  vendorName: string;
  expenses: Expense[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Top-N employees by receipt count. Default 5. */
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

export function buildVendorEmployeeSnapshot(inputs: VendorEmployeeSnapshotInputs): VendorEmployeeSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = normVendor(inputs.vendorName);
  const topN = inputs.topN ?? 5;

  const byEmp = new Map<string, { name: string; receipts: number; cents: number }>();
  let totalReceipts = 0;
  let totalCents = 0;

  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    if (e.receiptDate > asOf) continue;
    totalReceipts += 1;
    totalCents += e.amountCents;
    const cur = byEmp.get(e.employeeId) ?? { name: e.employeeName, receipts: 0, cents: 0 };
    cur.receipts += 1;
    cur.cents += e.amountCents;
    byEmp.set(e.employeeId, cur);
  }

  const sorted = [...byEmp.entries()]
    .map(([employeeId, v]) => ({
      employeeId,
      employeeName: v.name,
      receipts: v.receipts,
      totalCents: v.cents,
    }))
    .sort((a, b) => b.receipts - a.receipts || b.totalCents - a.totalCents);

  return {
    asOf,
    vendorName: inputs.vendorName,
    distinctEmployees: byEmp.size,
    totalReceipts,
    totalCents,
    topEmployees: sorted.slice(0, topN),
  };
}
