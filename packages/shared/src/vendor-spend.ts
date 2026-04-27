// Vendor spend report.
//
// Plain English: where did the money go? Walks AP invoices in a date
// range and rolls up total spend per vendor. Useful for:
//   - AP negotiation (top vendors get volume-discount conversations)
//   - 1099-NEC reasonableness check (cross-tabbed with vendor master)
//   - Concentration risk ("we're 80% reliant on Granite Rock — what
//     happens when they raise prices?")
//
// Pure derivation. No persisted records.
//
// Status filter: counts APPROVED, PENDING, and PAID invoices. DRAFT
// and REJECTED are skipped — those don't reflect actual spend
// commitments.

import type { ApInvoice } from './ap-invoice';

export interface VendorSpendRow {
  vendorName: string;
  /** Number of distinct invoices. */
  invoiceCount: number;
  /** Sum of totalCents across counted invoices. */
  totalSpendCents: number;
  /** Sum of paidCents — what's actually gone out the door. */
  totalPaidCents: number;
  /** totalSpend - totalPaid. The current open balance. */
  outstandingCents: number;
  /** First invoice date in the period. */
  firstInvoiceOn: string;
  /** Most recent invoice date in the period. */
  lastInvoiceOn: string;
  /** Spend share of the period total. 0..1. */
  shareOfPeriod: number;
}

export interface VendorSpendReport {
  start: string;
  end: string;
  totalSpendCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
  /** Number of distinct vendors. */
  vendorCount: number;
  rows: VendorSpendRow[];
  /** Top-5 vendors' share of total spend. Concentration risk signal. */
  top5SharePct: number;
}

export interface VendorSpendInputs {
  /** ISO yyyy-mm-dd inclusive. */
  start: string;
  end: string;
  apInvoices: ApInvoice[];
  /** When true, normalizes vendor names so "Acme Co." and
   *  "Acme Company LLC" collide. Default: true. */
  normalizeVendorNames?: boolean;
}

interface Bucket {
  display: string;
  variantCounts: Map<string, number>;
  invoices: number;
  spend: number;
  paid: number;
  firstInvoiceOn: string;
  lastInvoiceOn: string;
}

export function buildVendorSpendReport(
  inputs: VendorSpendInputs,
): VendorSpendReport {
  const { start, end, apInvoices } = inputs;
  const normalize = inputs.normalizeVendorNames !== false;

  const buckets = new Map<string, Bucket>();
  let totalSpendCents = 0;
  let totalPaidCents = 0;

  for (const inv of apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (inv.invoiceDate < start || inv.invoiceDate > end) continue;
    const raw = inv.vendorName.trim();
    if (!raw) continue;

    const key = normalize ? normalizeVendor(raw) : raw;
    const bucket =
      buckets.get(key) ??
      ({
        display: raw,
        variantCounts: new Map<string, number>(),
        invoices: 0,
        spend: 0,
        paid: 0,
        firstInvoiceOn: inv.invoiceDate,
        lastInvoiceOn: inv.invoiceDate,
      } as Bucket);

    bucket.variantCounts.set(raw, (bucket.variantCounts.get(raw) ?? 0) + 1);
    bucket.invoices += 1;
    bucket.spend += inv.totalCents;
    bucket.paid += inv.paidCents;
    if (inv.invoiceDate < bucket.firstInvoiceOn) bucket.firstInvoiceOn = inv.invoiceDate;
    if (inv.invoiceDate > bucket.lastInvoiceOn) bucket.lastInvoiceOn = inv.invoiceDate;
    buckets.set(key, bucket);

    totalSpendCents += inv.totalCents;
    totalPaidCents += inv.paidCents;
  }

  const rows: VendorSpendRow[] = [];
  for (const [, b] of buckets) {
    // Pick most-frequent variant as display.
    let bestVariant = b.display;
    let bestCount = b.variantCounts.get(b.display) ?? 0;
    for (const [variant, count] of b.variantCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestVariant = variant;
      }
    }
    rows.push({
      vendorName: bestVariant,
      invoiceCount: b.invoices,
      totalSpendCents: b.spend,
      totalPaidCents: b.paid,
      outstandingCents: Math.max(0, b.spend - b.paid),
      firstInvoiceOn: b.firstInvoiceOn,
      lastInvoiceOn: b.lastInvoiceOn,
      shareOfPeriod:
        totalSpendCents === 0 ? 0 : b.spend / totalSpendCents,
    });
  }

  // Highest spend first.
  rows.sort((a, b) => b.totalSpendCents - a.totalSpendCents);

  // Top 5 share of period — concentration signal.
  let top5 = 0;
  for (let i = 0; i < Math.min(5, rows.length); i += 1) {
    top5 += rows[i]!.totalSpendCents;
  }
  const top5SharePct =
    totalSpendCents === 0 ? 0 : top5 / totalSpendCents;

  return {
    start,
    end,
    totalSpendCents,
    totalPaidCents,
    totalOutstandingCents: Math.max(0, totalSpendCents - totalPaidCents),
    vendorCount: rows.length,
    rows,
    top5SharePct,
  };
}

/** Lowercase, drop punctuation, drop legal-suffix noise so
 *  "Acme Co." and "Acme Company LLC" collide. */
function normalizeVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
