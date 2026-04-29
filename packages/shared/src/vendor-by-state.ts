// Vendor count by state.
//
// Plain English: roll the vendor master up by state (free-form
// USPS code, e.g. 'CA', 'NV', 'OR'). Heavy civil tends to lean
// in-state for subcontracting (CSLB licensing) but suppliers can
// be regional. Useful for the vendor diversification review and
// out-of-state sub W-9 chase planning.
//
// Per row: state, total, byKind (SUPPLIER / SUBCONTRACTOR / etc.),
// onHoldCount, missingCoiSubs (subs with no COI on file).
//
// Sort by total desc.
//
// Different from vendor-spend (per-vendor totals),
// vendor-concentration (per-vendor share), vendor-prequal
// (per-vendor checklist). This is the geographic mix.
//
// Pure derivation. No persisted records.

import type { Vendor, VendorKind } from './vendor';

export interface VendorByStateRow {
  state: string;
  total: number;
  byKind: Partial<Record<VendorKind, number>>;
  onHoldCount: number;
  missingCoiSubs: number;
}

export interface VendorByStateRollup {
  statesConsidered: number;
  totalVendors: number;
  unattributed: number;
}

export interface VendorByStateInputs {
  vendors: Vendor[];
}

export function buildVendorByState(
  inputs: VendorByStateInputs,
): {
  rollup: VendorByStateRollup;
  rows: VendorByStateRow[];
} {
  type Acc = {
    display: string;
    total: number;
    kinds: Map<VendorKind, number>;
    onHold: number;
    missingCoi: number;
  };
  const accs = new Map<string, Acc>();
  let unattributed = 0;

  for (const v of inputs.vendors) {
    const display = (v.state ?? '').trim();
    if (!display) {
      unattributed += 1;
      continue;
    }
    const key = display.toUpperCase();
    const acc = accs.get(key) ?? {
      display: display.toUpperCase(),
      total: 0,
      kinds: new Map<VendorKind, number>(),
      onHold: 0,
      missingCoi: 0,
    };
    acc.total += 1;
    acc.kinds.set(v.kind, (acc.kinds.get(v.kind) ?? 0) + 1);
    if (v.onHold) acc.onHold += 1;
    if (v.kind === 'SUBCONTRACTOR' && !v.coiOnFile) acc.missingCoi += 1;
    accs.set(key, acc);
  }

  const rows: VendorByStateRow[] = [];
  for (const acc of accs.values()) {
    const kindObj: Partial<Record<VendorKind, number>> = {};
    for (const [k, v] of acc.kinds.entries()) kindObj[k] = v;
    rows.push({
      state: acc.display,
      total: acc.total,
      byKind: kindObj,
      onHoldCount: acc.onHold,
      missingCoiSubs: acc.missingCoi,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  return {
    rollup: {
      statesConsidered: rows.length,
      totalVendors: inputs.vendors.length,
      unattributed,
    },
    rows,
  };
}
