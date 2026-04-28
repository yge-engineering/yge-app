// Per-vendor invoice shape analysis.
//
// Plain English: most vendors have a recognizable invoice
// "shape" — a paving sub bills monthly with a few line items
// per ticket; a fuel vendor bills weekly with one line per
// fill-up; an attorney bills with detailed itemization. When a
// vendor's shape suddenly changes (new line items, much higher
// average), it's worth a closer look.
//
// This module walks AP invoices per vendor and reports:
//   - invoice count + total spend
//   - average invoice $ + median line $
//   - line count distribution (avg lines per invoice)
//   - top cost codes the vendor's lines hit
//   - top GL codes (when set)
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface CostCodeFreq {
  code: string;
  count: number;
}

export interface VendorInvoiceShapeRow {
  vendorName: string;
  invoiceCount: number;
  totalCents: number;
  avgInvoiceCents: number;
  /** Total line items across all invoices. */
  totalLineCount: number;
  avgLinesPerInvoice: number;
  /** Median line total (cents). */
  medianLineCents: number;
  topCostCodes: CostCodeFreq[];
  topGlCodes: CostCodeFreq[];
  /** Number of distinct cost codes seen. */
  distinctCostCodes: number;
}

export interface VendorInvoiceShapeRollup {
  vendorsConsidered: number;
  totalInvoices: number;
  totalCents: number;
}

export interface VendorInvoiceShapeInputs {
  /** Optional yyyy-mm-dd window. */
  fromDate?: string;
  toDate?: string;
  apInvoices: ApInvoice[];
  /** Top-N for cost-code + GL-code lists. Default 5. */
  topN?: number;
  /** Min invoice count for a vendor to surface. Default 1. */
  minInvoices?: number;
}

export function buildVendorInvoiceShape(
  inputs: VendorInvoiceShapeInputs,
): {
  rollup: VendorInvoiceShapeRollup;
  rows: VendorInvoiceShapeRow[];
} {
  const topN = inputs.topN ?? 5;
  const minInvoices = inputs.minInvoices ?? 1;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  type Bucket = {
    vendorName: string;
    invoiceCount: number;
    totalCents: number;
    lineCount: number;
    lineTotals: number[];
    costCodeCounts: Map<string, number>;
    glCodeCounts: Map<string, number>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inRange(inv.invoiceDate)) continue;
    const key = inv.vendorName.trim().toLowerCase();
    const b = buckets.get(key) ?? {
      vendorName: inv.vendorName.trim(),
      invoiceCount: 0,
      totalCents: 0,
      lineCount: 0,
      lineTotals: [],
      costCodeCounts: new Map<string, number>(),
      glCodeCounts: new Map<string, number>(),
    };
    b.invoiceCount += 1;
    b.totalCents += inv.totalCents;
    for (const li of inv.lineItems) {
      b.lineCount += 1;
      b.lineTotals.push(li.lineTotalCents);
      if (li.costCode) {
        b.costCodeCounts.set(li.costCode, (b.costCodeCounts.get(li.costCode) ?? 0) + 1);
      }
      if (li.glCode) {
        b.glCodeCounts.set(li.glCode, (b.glCodeCounts.get(li.glCode) ?? 0) + 1);
      }
    }
    buckets.set(key, b);
  }

  const rows: VendorInvoiceShapeRow[] = [];
  let totalInvoices = 0;
  let totalSpend = 0;

  for (const b of buckets.values()) {
    if (b.invoiceCount < minInvoices) continue;
    const avgInv = Math.round(b.totalCents / b.invoiceCount);
    const avgLines = round1(b.lineCount / b.invoiceCount);
    const medianLine = computeMedian(b.lineTotals);
    const topCost = topEntries(b.costCodeCounts, topN);
    const topGl = topEntries(b.glCodeCounts, topN);

    rows.push({
      vendorName: b.vendorName,
      invoiceCount: b.invoiceCount,
      totalCents: b.totalCents,
      avgInvoiceCents: avgInv,
      totalLineCount: b.lineCount,
      avgLinesPerInvoice: avgLines,
      medianLineCents: medianLine,
      topCostCodes: topCost,
      topGlCodes: topGl,
      distinctCostCodes: b.costCodeCounts.size,
    });
    totalInvoices += b.invoiceCount;
    totalSpend += b.totalCents;
  }

  // Highest total spend first.
  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    rollup: {
      vendorsConsidered: rows.length,
      totalInvoices,
      totalCents: totalSpend,
    },
    rows,
  };
}

function topEntries(m: Map<string, number>, n: number): CostCodeFreq[] {
  return Array.from(m.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
