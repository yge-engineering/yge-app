// Per-vendor invoice size distribution.
//
// Plain English: for each vendor we get AP invoices from, what's
// the SHAPE of their typical invoice size? Mean, median, standard
// deviation. Plus a flag for "outlier" invoices — anything more
// than 2 standard deviations from this vendor's median, which
// usually means a typo (e.g., $50,000 typed where $500 was meant)
// or a one-off big charge worth a second look.
//
// Different from vendor-invoice-shape (which is per-line-item
// composition) — this is one number per invoice (the totalCents)
// distribution per vendor.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface InvoiceOutlier {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalCents: number;
  /** Z-score of this invoice vs the vendor's median + stdDev.
   *  Positive = above the typical amount; negative = below. */
  zScore: number;
}

export interface VendorInvoiceSizeRow {
  vendorName: string;
  invoiceCount: number;
  totalCents: number;
  meanCents: number;
  medianCents: number;
  stdDevCents: number;
  /** Smallest non-zero totalCents observed. */
  minCents: number;
  maxCents: number;
  /** Invoices whose totalCents is more than 2 stdDevs from median. */
  outliers: InvoiceOutlier[];
}

export interface VendorInvoiceSizeRollup {
  vendorsConsidered: number;
  invoicesConsidered: number;
  totalOutliers: number;
}

export interface VendorInvoiceSizeInputs {
  apInvoices: ApInvoice[];
  /** Z-score cutoff for an invoice to count as an outlier. Default 2. */
  outlierZThreshold?: number;
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
  /** Minimum number of invoices a vendor needs before stdDev is
   *  meaningful. Below this, no outliers are flagged. Default 4. */
  minInvoicesForStats?: number;
}

export function buildVendorInvoiceSize(inputs: VendorInvoiceSizeInputs): {
  rollup: VendorInvoiceSizeRollup;
  rows: VendorInvoiceSizeRow[];
} {
  const zThreshold = inputs.outlierZThreshold ?? 2;
  const minN = inputs.minInvoicesForStats ?? 4;

  // Bucket invoices by canonical vendor name.
  const buckets = new Map<string, ApInvoice[]>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (inputs.fromDate && inv.invoiceDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.invoiceDate > inputs.toDate) continue;
    const key = canonicalize(inv.vendorName);
    const list = buckets.get(key) ?? [];
    list.push(inv);
    buckets.set(key, list);
  }

  const rows: VendorInvoiceSizeRow[] = [];
  let totalOutliers = 0;
  let invoicesConsidered = 0;

  for (const [, invs] of buckets.entries()) {
    invoicesConsidered += invs.length;
    const totals = invs.map((i) => i.totalCents);
    const sorted = [...totals].sort((a, b) => a - b);
    const sum = totals.reduce((acc, n) => acc + n, 0);
    const mean = totals.length === 0 ? 0 : sum / totals.length;
    const median = computeMedian(sorted);
    const stdDev = computeStdDev(totals, mean);
    const min = sorted[0] ?? 0;
    const max = sorted[sorted.length - 1] ?? 0;

    // Outliers — only meaningful with enough samples and non-zero stdDev.
    let outliers: InvoiceOutlier[] = [];
    if (invs.length >= minN && stdDev > 0) {
      for (const inv of invs) {
        const z = (inv.totalCents - median) / stdDev;
        if (Math.abs(z) >= zThreshold) {
          outliers.push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber ?? '',
            invoiceDate: inv.invoiceDate,
            totalCents: inv.totalCents,
            zScore: round4(z),
          });
        }
      }
      // Sort outliers by absolute z-score desc.
      outliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    }
    totalOutliers += outliers.length;

    // Use the first invoice's vendorName for display so we don't lose
    // capitalization/punctuation.
    const displayName = invs[0]?.vendorName ?? '';

    rows.push({
      vendorName: displayName,
      invoiceCount: invs.length,
      totalCents: sum,
      meanCents: Math.round(mean),
      medianCents: Math.round(median),
      stdDevCents: Math.round(stdDev),
      minCents: min,
      maxCents: max,
      outliers,
    });
  }

  // Sort rows by totalCents desc — biggest spenders first.
  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    rollup: {
      vendorsConsidered: rows.length,
      invoicesConsidered,
      totalOutliers,
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

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return (a + b) / 2;
}

function computeStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
