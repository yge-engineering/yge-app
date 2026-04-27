// Vendor spend concentration analysis.
//
// Plain English: every dollar YGE spends goes to a vendor. When
// 80% of yearly spend rides on three subs, "what happens if our
// favorite paving sub goes under" is a real conversation. This
// walks AP invoices in a date range and produces the concentration
// view: who do we spend with, how much, and how dependent are we
// on a small set?
//
// Same shape as customer-concentration so the dashboards line up.
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface VendorSpendRow {
  vendorName: string;
  /** Sum of totalCents across DRAFT/REJECTED-excluded invoices. */
  spendCents: number;
  /** Sum of paidCents — what's actually gone out the door. */
  paidCents: number;
  invoiceCount: number;
  /** Distinct jobIds this vendor was invoiced on. */
  jobCount: number;
  /** spend / period total. 0..1. */
  shareOfPeriod: number;
}

export interface VendorConcentrationReport {
  start: string;
  end: string;
  totalSpendCents: number;
  totalPaidCents: number;
  rows: VendorSpendRow[];

  /** Share of period spend represented by the top vendor. */
  top1SharePct: number;
  /** Top 3 vendors share. */
  top3SharePct: number;
  /** Top 5 vendors share. */
  top5SharePct: number;

  /** Herfindahl-Hirschman Index across vendors (sum of squared
   *  shares × 10000). 10000 = monopoly, near 0 = perfectly diffuse. */
  hhi: number;
}

export interface VendorConcentrationInputs {
  start: string;
  end: string;
  apInvoices: ApInvoice[];
  /** When true (default), trim+lowercase the vendorName so casing
   *  variants are collapsed. */
  caseInsensitive?: boolean;
}

export function buildVendorConcentration(
  inputs: VendorConcentrationInputs,
): VendorConcentrationReport {
  const { start, end, apInvoices } = inputs;
  const caseInsensitive = inputs.caseInsensitive !== false;

  type Bucket = {
    vendorName: string;
    spendCents: number;
    paidCents: number;
    invoiceCount: number;
    jobIds: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (inv.invoiceDate < start || inv.invoiceDate > end) continue;
    const key = caseInsensitive
      ? inv.vendorName.trim().toLowerCase()
      : inv.vendorName.trim();
    const b = buckets.get(key) ?? {
      vendorName: inv.vendorName.trim(),
      spendCents: 0,
      paidCents: 0,
      invoiceCount: 0,
      jobIds: new Set<string>(),
    };
    b.spendCents += inv.totalCents;
    b.paidCents += inv.paidCents;
    b.invoiceCount += 1;
    if (inv.jobId) b.jobIds.add(inv.jobId);
    buckets.set(key, b);
  }

  const totalSpend = Array.from(buckets.values()).reduce(
    (acc, b) => acc + b.spendCents,
    0,
  );
  const totalPaid = Array.from(buckets.values()).reduce(
    (acc, b) => acc + b.paidCents,
    0,
  );

  const rows: VendorSpendRow[] = Array.from(buckets.values())
    .map((b) => ({
      vendorName: b.vendorName,
      spendCents: b.spendCents,
      paidCents: b.paidCents,
      invoiceCount: b.invoiceCount,
      jobCount: b.jobIds.size,
      shareOfPeriod:
        totalSpend === 0 ? 0 : round4(b.spendCents / totalSpend),
    }))
    .sort((a, b) => b.spendCents - a.spendCents);

  const top1 = rows[0]?.shareOfPeriod ?? 0;
  const top3 = rows
    .slice(0, 3)
    .reduce((acc, r) => acc + r.shareOfPeriod, 0);
  const top5 = rows
    .slice(0, 5)
    .reduce((acc, r) => acc + r.shareOfPeriod, 0);

  let hhi = 0;
  for (const r of rows) hhi += r.shareOfPeriod * r.shareOfPeriod;
  hhi = Math.round(hhi * 10_000);

  return {
    start,
    end,
    totalSpendCents: totalSpend,
    totalPaidCents: totalPaid,
    rows,
    top1SharePct: round4(top1),
    top3SharePct: round4(top3),
    top5SharePct: round4(top5),
    hhi,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
