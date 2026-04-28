// Per-vendor AP invoice line count distribution.
//
// Plain English: count how many lines each vendor's invoices
// usually carry. A supplier whose invoices average 30+ lines is
// shipping detail; a supplier whose invoices are 1-line lump sums
// gives the bookkeeper no way to verify what was billed for.
//
// Per vendor: invoiceCount, totalLines, avgLines, minLines,
// maxLines, lumpSumCount (invoices with exactly 1 line),
// lumpSumShare. Sort puts high-lump-sum vendors first — those
// are the ones to push for itemized billing.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface VendorLineCountRow {
  vendorName: string;
  invoiceCount: number;
  totalLines: number;
  avgLines: number;
  minLines: number;
  maxLines: number;
  /** Invoices with exactly 1 line item (lump-sum bills). */
  lumpSumCount: number;
  /** lumpSumCount / invoiceCount. 0 when no invoices. */
  lumpSumShare: number;
}

export interface VendorLineCountRollup {
  vendorsConsidered: number;
  invoicesConsidered: number;
  totalLumpSum: number;
}

export interface VendorLineCountInputs {
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm-dd window on invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildVendorLineCount(inputs: VendorLineCountInputs): {
  rollup: VendorLineCountRollup;
  rows: VendorLineCountRow[];
} {
  const buckets = new Map<string, ApInvoice[]>();
  const displayNames = new Map<string, string>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (inputs.fromDate && inv.invoiceDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.invoiceDate > inputs.toDate) continue;
    const key = canonicalize(inv.vendorName);
    const list = buckets.get(key) ?? [];
    list.push(inv);
    buckets.set(key, list);
    if (!displayNames.has(key)) displayNames.set(key, inv.vendorName);
  }

  const rows: VendorLineCountRow[] = [];
  let invoicesConsidered = 0;
  let totalLumpSum = 0;

  for (const [key, invs] of buckets.entries()) {
    let totalLines = 0;
    let minLines = Number.POSITIVE_INFINITY;
    let maxLines = 0;
    let lumpSum = 0;
    for (const inv of invs) {
      const n = inv.lineItems.length;
      totalLines += n;
      if (n < minLines) minLines = n;
      if (n > maxLines) maxLines = n;
      if (n === 1) lumpSum += 1;
    }
    if (minLines === Number.POSITIVE_INFINITY) minLines = 0;
    const count = invs.length;
    const avg = count === 0 ? 0 : Math.round((totalLines / count) * 10) / 10;
    const lumpShare = count === 0 ? 0 : Math.round((lumpSum / count) * 10_000) / 10_000;

    rows.push({
      vendorName: displayNames.get(key) ?? key,
      invoiceCount: count,
      totalLines,
      avgLines: avg,
      minLines,
      maxLines,
      lumpSumCount: lumpSum,
      lumpSumShare: lumpShare,
    });

    invoicesConsidered += count;
    totalLumpSum += lumpSum;
  }

  // Sort: highest lump-sum share first (most actionable), then by
  // invoice count desc.
  rows.sort((a, b) => {
    if (a.lumpSumShare !== b.lumpSumShare) return b.lumpSumShare - a.lumpSumShare;
    return b.invoiceCount - a.invoiceCount;
  });

  return {
    rollup: {
      vendorsConsidered: rows.length,
      invoicesConsidered,
      totalLumpSum,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
