// Vendor W-9 expirations by month.
//
// Plain English: bucket 1099-reportable vendors with a current
// W-9 (collected within IRS 3-year window) by yyyy-mm of expiry
// (collectedOn + 3 years). The forward calendar that says "Jane
// Vendor's W-9 we collected on 2023-08-12 lapses in 2026-08, get
// a refresh now."
//
// Per row: month, total, distinctVendors.
//
// Sort by month asc.
//
// Different from vendor-w9-chase (chase list of missing W-9s),
// vendor-1099-status-mix (current portfolio mix).
//
// Pure derivation. No persisted records.

import type { Vendor } from './vendor';

const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;

export interface VendorW9MonthlyExpiringRow {
  month: string;
  total: number;
  distinctVendors: number;
}

export interface VendorW9MonthlyExpiringRollup {
  monthsConsidered: number;
  total: number;
}

export interface VendorW9MonthlyExpiringInputs {
  vendors: Vendor[];
  /** Reference 'now' as yyyy-mm-dd. Defaults to today. */
  asOf?: string;
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildVendorW9MonthlyExpiring(
  inputs: VendorW9MonthlyExpiringInputs,
): {
  rollup: VendorW9MonthlyExpiringRollup;
  rows: VendorW9MonthlyExpiringRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const asOfMs = Date.parse(asOf + 'T00:00:00Z');

  type Bucket = {
    month: string;
    total: number;
    vendors: Set<string>;
  };
  const buckets = new Map<string, Bucket>();
  let total = 0;

  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) continue;
    if (!v.w9OnFile || !v.w9CollectedOn) continue;
    const collectedMs = Date.parse(v.w9CollectedOn + 'T00:00:00Z');
    if (Number.isNaN(collectedMs)) continue;
    const expiryMs = collectedMs + THREE_YEARS_MS;
    if (expiryMs < asOfMs) continue;
    const expiry = new Date(expiryMs).toISOString().slice(0, 10);
    const month = expiry.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? { month, total: 0, vendors: new Set<string>() };
    b.total += 1;
    b.vendors.add(v.id);
    buckets.set(month, b);
    total += 1;
  }

  const rows: VendorW9MonthlyExpiringRow[] = Array.from(buckets.values())
    .map((b) => ({
      month: b.month,
      total: b.total,
      distinctVendors: b.vendors.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      total,
    },
    rows,
  };
}
