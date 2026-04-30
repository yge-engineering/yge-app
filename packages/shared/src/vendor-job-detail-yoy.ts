// Vendor-anchored per-job spend year-over-year detail rows.
//
// Plain English: for one vendor (matched via canonicalized
// name), return one row per job that vendor billed against in
// EITHER year. Each row carries prior + current AP + expense
// cents and the deltas — surfaces "we shifted from j1 to j2".
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

export interface VendorJobDetailYoyRow {
  jobId: string;
  priorApBilledCents: number;
  priorExpenseReceiptCents: number;
  priorTotalCents: number;
  currentApBilledCents: number;
  currentExpenseReceiptCents: number;
  currentTotalCents: number;
  totalDelta: number;
}

export interface VendorJobDetailYoyResult {
  vendorName: string;
  priorYear: number;
  currentYear: number;
  rows: VendorJobDetailYoyRow[];
}

export interface VendorJobDetailYoyInputs {
  vendorName: string;
  apInvoices: ApInvoice[];
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

export function buildVendorJobDetailYoy(inputs: VendorJobDetailYoyInputs): VendorJobDetailYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = normVendor(inputs.vendorName);

  type Acc = {
    priorAp: number;
    priorExp: number;
    currentAp: number;
    currentExp: number;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { priorAp: 0, priorExp: 0, currentAp: 0, currentExp: 0 };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const inv of inputs.apInvoices) {
    if (normVendor(inv.vendorName) !== target) continue;
    if (!inv.jobId) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    if (year === priorYear) getAcc(inv.jobId).priorAp += inv.totalCents ?? 0;
    else if (year === inputs.currentYear) getAcc(inv.jobId).currentAp += inv.totalCents ?? 0;
  }
  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    if (!e.jobId) continue;
    const year = Number(e.receiptDate.slice(0, 4));
    if (year === priorYear) getAcc(e.jobId).priorExp += e.amountCents;
    else if (year === inputs.currentYear) getAcc(e.jobId).currentExp += e.amountCents;
  }

  const rows: VendorJobDetailYoyRow[] = [...byJob.entries()]
    .map(([jobId, a]) => {
      const priorTotal = a.priorAp + a.priorExp;
      const currentTotal = a.currentAp + a.currentExp;
      return {
        jobId,
        priorApBilledCents: a.priorAp,
        priorExpenseReceiptCents: a.priorExp,
        priorTotalCents: priorTotal,
        currentApBilledCents: a.currentAp,
        currentExpenseReceiptCents: a.currentExp,
        currentTotalCents: currentTotal,
        totalDelta: currentTotal - priorTotal,
      };
    })
    .sort((a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta) || a.jobId.localeCompare(b.jobId));

  return {
    vendorName: inputs.vendorName,
    priorYear,
    currentYear: inputs.currentYear,
    rows,
  };
}
