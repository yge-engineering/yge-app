// AP unmatched vendor cleanup list.
//
// Plain English: every AP invoice carries a free-form vendorName.
// As soon as the vendor master record exists, that name should
// match one of the legalName / dbaName values. When it doesn't,
// either:
//   - the vendor was never set up (bookkeeping hygiene gap)
//   - the name was misspelled / typed differently (data cleanup)
//
// Either way, those invoices won't roll up into vendor reports
// (concentration, payment velocity, COI watch, 1099 prep, etc.)
// because the join misses. This walks AP, finds the misses, and
// groups them by normalized name so each one becomes a single
// "create or fix this" task.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

export interface ApUnmatchedRow {
  /** Display name as typed on the AP invoice (first occurrence wins). */
  vendorNameAsTyped: string;
  /** Normalized form used for grouping. */
  normalizedName: string;
  invoiceCount: number;
  totalCents: number;
  paidCents: number;
  earliestInvoiceDate: string;
  latestInvoiceDate: string;
  /** Distinct invoice IDs (for the cleanup task). */
  sampleInvoiceIds: string[];
}

export interface ApUnmatchedRollup {
  unmatchedNameCount: number;
  unmatchedInvoiceCount: number;
  unmatchedTotalCents: number;
  unmatchedPaidCents: number;
}

export interface ApUnmatchedInputs {
  /** Optional yyyy-mm-dd window. */
  fromDate?: string;
  toDate?: string;
  vendors: Vendor[];
  apInvoices: ApInvoice[];
}

export function buildApUnmatchedVendors(inputs: ApUnmatchedInputs): {
  rollup: ApUnmatchedRollup;
  rows: ApUnmatchedRow[];
} {
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  // Build the known-vendor name set (legalName + dbaName, normalized).
  const known = new Set<string>();
  for (const v of inputs.vendors) {
    known.add(normalize(v.legalName));
    if (v.dbaName) known.add(normalize(v.dbaName));
  }

  type Bucket = {
    nameAsTyped: string;
    normalized: string;
    invoiceCount: number;
    totalCents: number;
    paidCents: number;
    earliest: string;
    latest: string;
    sampleIds: string[];
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inRange(inv.invoiceDate)) continue;
    const norm = normalize(inv.vendorName);
    if (norm === '') continue; // empty name — surfaced separately
    if (known.has(norm)) continue; // matches a Vendor master row

    const b = buckets.get(norm) ?? {
      nameAsTyped: inv.vendorName.trim(),
      normalized: norm,
      invoiceCount: 0,
      totalCents: 0,
      paidCents: 0,
      earliest: inv.invoiceDate,
      latest: inv.invoiceDate,
      sampleIds: [],
    };
    b.invoiceCount += 1;
    b.totalCents += inv.totalCents;
    b.paidCents += inv.paidCents;
    if (inv.invoiceDate < b.earliest) b.earliest = inv.invoiceDate;
    if (inv.invoiceDate > b.latest) b.latest = inv.invoiceDate;
    if (b.sampleIds.length < 5) b.sampleIds.push(inv.id);
    buckets.set(norm, b);
  }

  const rows: ApUnmatchedRow[] = Array.from(buckets.values())
    .map((b) => ({
      vendorNameAsTyped: b.nameAsTyped,
      normalizedName: b.normalized,
      invoiceCount: b.invoiceCount,
      totalCents: b.totalCents,
      paidCents: b.paidCents,
      earliestInvoiceDate: b.earliest,
      latestInvoiceDate: b.latest,
      sampleInvoiceIds: b.sampleIds,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  let totalCents = 0;
  let paidCents = 0;
  let invoiceCount = 0;
  for (const r of rows) {
    totalCents += r.totalCents;
    paidCents += r.paidCents;
    invoiceCount += r.invoiceCount;
  }

  return {
    rollup: {
      unmatchedNameCount: rows.length,
      unmatchedInvoiceCount: invoiceCount,
      unmatchedTotalCents: totalCents,
      unmatchedPaidCents: paidCents,
    },
    rows,
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
