// Vendor 1099 readiness status mix.
//
// Plain English: every vendor on file falls into one of four
// 1099 buckets:
//   READY        — flagged 1099-reportable + W-9 on file + within
//                  IRS 3-year refresh window
//   STALE_W9     — flagged 1099-reportable + W-9 on file but
//                  collected > 3 years ago (IRS wants a fresh one)
//   MISSING_W9   — flagged 1099-reportable but no W-9 on file
//   NOT_REPORTABLE — vendor not flagged 1099-reportable
//
// This is the year-end planning view for the bookkeeper — by
// October each year, MISSING_W9 should be empty.
//
// Per row: tier, total, byKind (SUPPLIER / SUBCONTRACTOR / etc.).
//
// Sort order: READY → STALE_W9 → MISSING_W9 → NOT_REPORTABLE.
//
// Different from vendor-w9-chase (per-vendor chase list with YTD
// spend), vendor-1099-readiness (similar tier but per-vendor).
// This is the portfolio mix.
//
// Pure derivation. No persisted records.

import type { Vendor, VendorKind } from './vendor';
import { vendorW9Current } from './vendor';

export type Vendor1099Tier = 'READY' | 'STALE_W9' | 'MISSING_W9' | 'NOT_REPORTABLE';

export interface Vendor1099StatusMixRow {
  tier: Vendor1099Tier;
  total: number;
  byKind: Partial<Record<VendorKind, number>>;
}

export interface Vendor1099StatusMixRollup {
  tiersConsidered: number;
  totalVendors: number;
  reportableTotal: number;
  readyCount: number;
  needAttention: number;
}

export interface Vendor1099StatusMixInputs {
  vendors: Vendor[];
  /** Reference 'now' for W9-currency check. Defaults to now. */
  asOf?: Date;
}

const TIER_ORDER: Vendor1099Tier[] = ['READY', 'STALE_W9', 'MISSING_W9', 'NOT_REPORTABLE'];

export function buildVendor1099StatusMix(
  inputs: Vendor1099StatusMixInputs,
): {
  rollup: Vendor1099StatusMixRollup;
  rows: Vendor1099StatusMixRow[];
} {
  const asOf = inputs.asOf ?? new Date();
  type Acc = {
    total: number;
    kinds: Map<VendorKind, number>;
  };
  const accs = new Map<Vendor1099Tier, Acc>();
  for (const t of TIER_ORDER) {
    accs.set(t, { total: 0, kinds: new Map() });
  }
  let reportableTotal = 0;
  let needAttention = 0;

  for (const v of inputs.vendors) {
    let tier: Vendor1099Tier;
    if (!v.is1099Reportable) {
      tier = 'NOT_REPORTABLE';
    } else if (!v.w9OnFile) {
      tier = 'MISSING_W9';
      needAttention += 1;
      reportableTotal += 1;
    } else if (vendorW9Current(v, asOf)) {
      tier = 'READY';
      reportableTotal += 1;
    } else {
      tier = 'STALE_W9';
      needAttention += 1;
      reportableTotal += 1;
    }
    const acc = accs.get(tier)!;
    acc.total += 1;
    acc.kinds.set(v.kind, (acc.kinds.get(v.kind) ?? 0) + 1);
  }

  const rows: Vendor1099StatusMixRow[] = [];
  for (const tier of TIER_ORDER) {
    const acc = accs.get(tier);
    if (!acc) continue;
    const obj: Partial<Record<VendorKind, number>> = {};
    for (const [k, v] of acc.kinds.entries()) obj[k] = v;
    rows.push({
      tier,
      total: acc.total,
      byKind: obj,
    });
  }

  const ready = accs.get('READY')?.total ?? 0;

  return {
    rollup: {
      tiersConsidered: rows.length,
      totalVendors: inputs.vendors.length,
      reportableTotal,
      readyCount: ready,
      needAttention,
    },
    rows,
  };
}
