// Vendor pre-qualification status summary.
//
// Plain English: across the SUBCONTRACTOR vendor list, how many
// pass every required prequal check (W-9 + COI + CSLB + DIR +
// not on hold) vs. how many are blocked? Public-works compliance
// at a glance.
//
// Per row: tier (READY / NEEDS_W9 / NEEDS_COI / NEEDS_CSLB /
// NEEDS_DIR / ON_HOLD), count, percent.
//
// Sort fixed: READY → NEEDS_W9 → NEEDS_COI → NEEDS_CSLB →
// NEEDS_DIR → ON_HOLD.
//
// Different from vendor-prequal (per-vendor checklist),
// vendor-w9-chase (W-9 only chase list), vendor-coi-aging (COI
// only aging).
//
// Pure derivation. No persisted records.

import type { Vendor } from './vendor';
import { vendorCoiCurrent, vendorW9Current } from './vendor';

export type PrequalTier =
  | 'READY'
  | 'NEEDS_W9'
  | 'NEEDS_COI'
  | 'NEEDS_CSLB'
  | 'NEEDS_DIR'
  | 'ON_HOLD';

export interface VendorPrequalSummaryRow {
  tier: PrequalTier;
  label: string;
  count: number;
  percent: number;
}

export interface VendorPrequalSummaryRollup {
  subsConsidered: number;
  readyCount: number;
  blockedCount: number;
}

export interface VendorPrequalSummaryInputs {
  vendors: Vendor[];
  /** Reference 'now' for W9/COI currency. Defaults to now. */
  asOf?: Date;
}

const ORDER: PrequalTier[] = ['READY', 'NEEDS_W9', 'NEEDS_COI', 'NEEDS_CSLB', 'NEEDS_DIR', 'ON_HOLD'];
const LABELS: Record<PrequalTier, string> = {
  READY: 'Ready',
  NEEDS_W9: 'Needs W-9',
  NEEDS_COI: 'Needs COI',
  NEEDS_CSLB: 'Needs CSLB',
  NEEDS_DIR: 'Needs DIR',
  ON_HOLD: 'On hold',
};

export function buildVendorPrequalSummary(
  inputs: VendorPrequalSummaryInputs,
): {
  rollup: VendorPrequalSummaryRollup;
  rows: VendorPrequalSummaryRow[];
} {
  const asOf = inputs.asOf ?? new Date();
  const counts = new Map<PrequalTier, number>();
  for (const t of ORDER) counts.set(t, 0);

  let subs = 0;
  let ready = 0;
  let blocked = 0;

  for (const v of inputs.vendors) {
    if (v.kind !== 'SUBCONTRACTOR') continue;
    subs += 1;
    let tier: PrequalTier;
    if (v.onHold) {
      tier = 'ON_HOLD';
      blocked += 1;
    } else if (!vendorW9Current(v, asOf)) {
      tier = 'NEEDS_W9';
      blocked += 1;
    } else if (!vendorCoiCurrent(v, asOf)) {
      tier = 'NEEDS_COI';
      blocked += 1;
    } else if (!hasCslb(v)) {
      tier = 'NEEDS_CSLB';
      blocked += 1;
    } else if (!hasDir(v)) {
      tier = 'NEEDS_DIR';
      blocked += 1;
    } else {
      tier = 'READY';
      ready += 1;
    }
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }

  const rows: VendorPrequalSummaryRow[] = [];
  for (const tier of ORDER) {
    const count = counts.get(tier) ?? 0;
    const percent = subs === 0 ? 0 : Math.round((count / subs) * 10_000) / 10_000;
    rows.push({ tier, label: LABELS[tier], count, percent });
  }

  return {
    rollup: {
      subsConsidered: subs,
      readyCount: ready,
      blockedCount: blocked,
    },
    rows,
  };
}

function hasCslb(v: Vendor): boolean {
  const cslb = (v as { cslbLicense?: string; cslbNumber?: string }).cslbLicense
    ?? (v as { cslbNumber?: string }).cslbNumber;
  return typeof cslb === 'string' && cslb.trim().length > 0;
}

function hasDir(v: Vendor): boolean {
  const dir = (v as { dirRegistration?: string; dirNumber?: string }).dirRegistration
    ?? (v as { dirNumber?: string }).dirNumber;
  return typeof dir === 'string' && dir.trim().length > 0;
}
