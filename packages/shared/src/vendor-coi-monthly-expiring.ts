// Subcontractor COI expirations by month.
//
// Plain English: bucket SUBCONTRACTOR vendors with a coiExpiresOn
// by yyyy-mm of expiry — the upcoming-renewal calendar in long
// format. Drives the "look 6 months out, see who's coming due"
// office task list.
//
// Per row: month, total, distinctVendors.
//
// Sort by month asc.
//
// Different from vendor-coi-aging (per-vendor aging tier),
// vendor-prequal (full prequal checklist).
//
// Pure derivation. No persisted records.

import type { Vendor } from './vendor';

export interface VendorCoiMonthlyExpiringRow {
  month: string;
  total: number;
  distinctVendors: number;
}

export interface VendorCoiMonthlyExpiringRollup {
  monthsConsidered: number;
  total: number;
}

export interface VendorCoiMonthlyExpiringInputs {
  vendors: Vendor[];
  /** Reference 'now' as yyyy-mm-dd. Defaults to today. */
  asOf?: string;
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildVendorCoiMonthlyExpiring(
  inputs: VendorCoiMonthlyExpiringInputs,
): {
  rollup: VendorCoiMonthlyExpiringRollup;
  rows: VendorCoiMonthlyExpiringRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  type Bucket = {
    month: string;
    total: number;
    vendors: Set<string>;
  };
  const buckets = new Map<string, Bucket>();
  let total = 0;

  for (const v of inputs.vendors) {
    if (v.kind !== 'SUBCONTRACTOR') continue;
    if (!v.coiExpiresOn) continue;
    if (v.coiExpiresOn < asOf) continue;
    const month = v.coiExpiresOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? { month, total: 0, vendors: new Set<string>() };
    b.total += 1;
    b.vendors.add(v.id);
    buckets.set(month, b);
    total += 1;
  }

  const rows: VendorCoiMonthlyExpiringRow[] = Array.from(buckets.values())
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
