// Vendor pre-qualification status by VendorKind.
//
// Plain English: roll the vendor master up by VendorKind
// (SUPPLIER / SUBCONTRACTOR / TRUCKING / PROFESSIONAL /
// EQUIPMENT_RENTAL / UTILITY / GOVERNMENT / OTHER), counting
// how many in each kind are READY (W-9 + COI + not on hold)
// vs. blocked. SUBCONTRACTOR carries the most prequal weight
// because public works require COI + CSLB + DIR — but every
// kind needs W-9 for 1099 reporting.
//
// Per row: kind, total, ready, missingW9, missingCoiSubs,
// onHold.
//
// Sort by total desc, ties by kind asc.
//
// Different from vendor-prequal-summary (per tier portfolio),
// vendor-prequal (per-vendor checklist), vendor-coi-aging
// (per-sub COI), vendor-w9-chase (per-vendor W-9). This is
// the per-kind portfolio view.
//
// Pure derivation. No persisted records.

import type { Vendor, VendorKind } from './vendor';
import { vendorCoiCurrent, vendorW9Current } from './vendor';

export interface VendorPrequalByKindRow {
  kind: VendorKind;
  total: number;
  ready: number;
  missingW9: number;
  missingCoiSubs: number;
  onHold: number;
}

export interface VendorPrequalByKindRollup {
  kindsConsidered: number;
  totalVendors: number;
  totalReady: number;
  totalMissingW9: number;
  totalMissingCoi: number;
  totalOnHold: number;
}

export interface VendorPrequalByKindInputs {
  vendors: Vendor[];
  /** Reference 'now' for currency checks. Defaults to today. */
  asOf?: Date;
}

export function buildVendorPrequalByKind(
  inputs: VendorPrequalByKindInputs,
): {
  rollup: VendorPrequalByKindRollup;
  rows: VendorPrequalByKindRow[];
} {
  const asOf = inputs.asOf ?? new Date();

  type Acc = {
    kind: VendorKind;
    total: number;
    ready: number;
    missingW9: number;
    missingCoiSubs: number;
    onHold: number;
  };
  const accs = new Map<VendorKind, Acc>();
  function get(k: VendorKind): Acc {
    let a = accs.get(k);
    if (!a) {
      a = {
        kind: k,
        total: 0,
        ready: 0,
        missingW9: 0,
        missingCoiSubs: 0,
        onHold: 0,
      };
      accs.set(k, a);
    }
    return a;
  }

  let totalVendors = 0;
  let totalReady = 0;
  let totalMissingW9 = 0;
  let totalMissingCoi = 0;
  let totalOnHold = 0;

  for (const v of inputs.vendors) {
    const a = get(v.kind);
    a.total += 1;
    totalVendors += 1;

    const w9OK = vendorW9Current(v, asOf);
    const coiOK = v.kind === 'SUBCONTRACTOR' ? vendorCoiCurrent(v, asOf) : true;
    const onHold = v.onHold === true;

    if (!w9OK) {
      a.missingW9 += 1;
      totalMissingW9 += 1;
    }
    if (v.kind === 'SUBCONTRACTOR' && !coiOK) {
      a.missingCoiSubs += 1;
      totalMissingCoi += 1;
    }
    if (onHold) {
      a.onHold += 1;
      totalOnHold += 1;
    }
    if (w9OK && coiOK && !onHold) {
      a.ready += 1;
      totalReady += 1;
    }
  }

  const rows = [...accs.values()].sort((x, y) => {
    if (x.total !== y.total) return y.total - x.total;
    return x.kind.localeCompare(y.kind);
  });

  return {
    rollup: {
      kindsConsidered: rows.length,
      totalVendors,
      totalReady,
      totalMissingW9,
      totalMissingCoi,
      totalOnHold,
    },
    rows,
  };
}
