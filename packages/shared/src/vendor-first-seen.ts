// First-seen-vendor tracker.
//
// Plain English: walk the AP invoice history and identify the
// FIRST date each vendor appeared. New vendors entering the AP
// system are a fraud-risk + onboarding-friction watchpoint:
//   - the first invoice should trigger W-9 collection, COI check,
//     prequal questionnaire (depending on vendor type)
//   - a sudden cluster of new vendors in one month is also worth
//     a second look (employee diverting work? buying off-list?)
//
// Per row: vendor canonical name, first-seen date, first invoice
// id, total invoices since first-seen, total paid since first-seen.
// Filter by `firstSeenAfter` to surface "vendors new since X".
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface VendorFirstSeenRow {
  vendorName: string;
  firstSeenDate: string;
  firstInvoiceId: string;
  invoiceCount: number;
  totalBilledCents: number;
  /** Days from first-seen to last-invoice. 0 if only one invoice. */
  spanDays: number;
}

export interface VendorFirstSeenRollup {
  vendorsConsidered: number;
  newVendorsInWindow: number;
  oldestFirstSeen: string | null;
  newestFirstSeen: string | null;
}

export interface VendorFirstSeenInputs {
  apInvoices: ApInvoice[];
  /** Only count vendors whose firstSeenDate is on or after this
   *  date (yyyy-mm-dd) toward `newVendorsInWindow`. Rows are still
   *  returned for every vendor; the rollup highlights the new
   *  ones. */
  firstSeenAfter?: string;
}

export function buildVendorFirstSeen(
  inputs: VendorFirstSeenInputs,
): {
  rollup: VendorFirstSeenRollup;
  rows: VendorFirstSeenRow[];
} {
  // Bucket by canonical vendor name. Skip DRAFT/REJECTED — those
  // didn't materially "happen".
  const buckets = new Map<string, ApInvoice[]>();
  const displayNames = new Map<string, string>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    const key = canonicalize(inv.vendorName);
    const list = buckets.get(key) ?? [];
    list.push(inv);
    buckets.set(key, list);
    if (!displayNames.has(key)) displayNames.set(key, inv.vendorName);
  }

  const rows: VendorFirstSeenRow[] = [];
  let newVendors = 0;
  let oldestFirstSeen: string | null = null;
  let newestFirstSeen: string | null = null;

  for (const [key, invs] of buckets.entries()) {
    // Sort by invoiceDate asc to find the first.
    const sorted = [...invs].sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;

    const firstSeenDate = first.invoiceDate;
    const lastDate = last.invoiceDate;
    const spanDays = daysBetween(firstSeenDate, lastDate);
    const totalBilled = invs.reduce((acc, i) => acc + i.totalCents, 0);

    rows.push({
      vendorName: displayNames.get(key) ?? key,
      firstSeenDate,
      firstInvoiceId: first.id,
      invoiceCount: invs.length,
      totalBilledCents: totalBilled,
      spanDays,
    });

    if (inputs.firstSeenAfter && firstSeenDate >= inputs.firstSeenAfter) {
      newVendors += 1;
    }

    if (oldestFirstSeen === null || firstSeenDate < oldestFirstSeen) {
      oldestFirstSeen = firstSeenDate;
    }
    if (newestFirstSeen === null || firstSeenDate > newestFirstSeen) {
      newestFirstSeen = firstSeenDate;
    }
  }

  // Sort by firstSeenDate desc so the newest vendors are at the top.
  rows.sort((a, b) => b.firstSeenDate.localeCompare(a.firstSeenDate));

  return {
    rollup: {
      vendorsConsidered: rows.length,
      newVendorsInWindow: newVendors,
      oldestFirstSeen,
      newestFirstSeen,
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

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
