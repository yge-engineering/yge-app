// Per-job AR aging snapshot.
//
// Plain English: per AWARDED-or-active job, how much money is
// outstanding by aging bucket — current, 1-30, 31-60, 61-90,
// 90+. Useful for the per-job collections review.
//
// Per row: jobId, totalUnpaidCents, currentCents, past1_30Cents,
// past31_60Cents, past61_90Cents, past90PlusCents,
// invoiceCount, oldestInvoiceDate.
//
// Sort by totalUnpaidCents desc.
//
// Different from customer-ar-aging-summary (portfolio bucket
// totals), customer-ar-aging (per-customer rollup), aging
// (per-invoice list).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface ArAgingByJobRow {
  jobId: string;
  totalUnpaidCents: number;
  currentCents: number;
  past1_30Cents: number;
  past31_60Cents: number;
  past61_90Cents: number;
  past90PlusCents: number;
  invoiceCount: number;
  oldestInvoiceDate: string | null;
}

export interface ArAgingByJobRollup {
  jobsConsidered: number;
  totalUnpaidCents: number;
  invoicesConsidered: number;
}

export interface ArAgingByJobInputs {
  arInvoices: ArInvoice[];
  /** Reference yyyy-mm-dd. Defaults to today. */
  asOf?: string;
}

export function buildArAgingByJob(
  inputs: ArAgingByJobInputs,
): {
  rollup: ArAgingByJobRollup;
  rows: ArAgingByJobRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const asOfMs = Date.parse(asOf + 'T00:00:00Z');

  type Acc = {
    jobId: string;
    unpaid: number;
    current: number;
    p1_30: number;
    p31_60: number;
    p61_90: number;
    p90: number;
    invoices: number;
    oldestDate: string | null;
  };
  const accs = new Map<string, Acc>();
  let totalUnpaid = 0;
  let invoicesConsidered = 0;

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'PAID' || inv.status === 'WRITTEN_OFF') continue;
    const unpaid = Math.max(0, inv.totalCents - inv.paidCents);
    if (unpaid <= 0) continue;
    const refDate = inv.dueDate ?? inv.invoiceDate;
    const refMs = Date.parse(refDate + 'T00:00:00Z');
    const days = Math.floor((asOfMs - refMs) / 86_400_000);
    const acc = accs.get(inv.jobId) ?? {
      jobId: inv.jobId,
      unpaid: 0,
      current: 0,
      p1_30: 0,
      p31_60: 0,
      p61_90: 0,
      p90: 0,
      invoices: 0,
      oldestDate: null,
    };
    acc.unpaid += unpaid;
    acc.invoices += 1;
    if (days <= 0) acc.current += unpaid;
    else if (days <= 30) acc.p1_30 += unpaid;
    else if (days <= 60) acc.p31_60 += unpaid;
    else if (days <= 90) acc.p61_90 += unpaid;
    else acc.p90 += unpaid;
    if (!acc.oldestDate || inv.invoiceDate < acc.oldestDate) acc.oldestDate = inv.invoiceDate;
    accs.set(inv.jobId, acc);
    totalUnpaid += unpaid;
    invoicesConsidered += 1;
  }

  const rows: ArAgingByJobRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      totalUnpaidCents: acc.unpaid,
      currentCents: acc.current,
      past1_30Cents: acc.p1_30,
      past31_60Cents: acc.p31_60,
      past61_90Cents: acc.p61_90,
      past90PlusCents: acc.p90,
      invoiceCount: acc.invoices,
      oldestInvoiceDate: acc.oldestDate,
    });
  }

  rows.sort((a, b) => b.totalUnpaidCents - a.totalUnpaidCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalUnpaidCents: totalUnpaid,
      invoicesConsidered,
    },
    rows,
  };
}
