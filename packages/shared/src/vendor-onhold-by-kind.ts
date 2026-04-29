// On-hold vendor count by VendorKind.
//
// Plain English: of the on-hold vendor list, how many are
// SUBCONTRACTOR vs SUPPLIER vs EQUIPMENT_RENTAL etc.? Heavy
// SUBCONTRACTOR on-hold counts are the riskiest because public-
// works projects need active subs.
//
// Per row: kind, total, missingCoiCount (subs only),
// missingW9Count.
//
// Sort by total desc.
//
// Different from vendor-onhold-list (per-vendor follow-up
// list with YTD spend), vendor-1099-status-mix.
//
// Pure derivation. No persisted records.

import type { Vendor, VendorKind } from './vendor';

export interface VendorOnholdByKindRow {
  kind: VendorKind;
  total: number;
  missingCoiCount: number;
  missingW9Count: number;
}

export interface VendorOnholdByKindRollup {
  kindsConsidered: number;
  totalOnHold: number;
}

export interface VendorOnholdByKindInputs {
  vendors: Vendor[];
}

export function buildVendorOnholdByKind(
  inputs: VendorOnholdByKindInputs,
): {
  rollup: VendorOnholdByKindRollup;
  rows: VendorOnholdByKindRow[];
} {
  type Acc = {
    total: number;
    missingCoi: number;
    missingW9: number;
  };
  const accs = new Map<VendorKind, Acc>();
  let totalOnHold = 0;

  for (const v of inputs.vendors) {
    if (!v.onHold) continue;
    totalOnHold += 1;
    const acc = accs.get(v.kind) ?? { total: 0, missingCoi: 0, missingW9: 0 };
    acc.total += 1;
    if (v.kind === 'SUBCONTRACTOR' && !v.coiOnFile) acc.missingCoi += 1;
    if (v.is1099Reportable && !v.w9OnFile) acc.missingW9 += 1;
    accs.set(v.kind, acc);
  }

  const rows: VendorOnholdByKindRow[] = [];
  for (const [kind, acc] of accs.entries()) {
    rows.push({
      kind,
      total: acc.total,
      missingCoiCount: acc.missingCoi,
      missingW9Count: acc.missingW9,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  return {
    rollup: {
      kindsConsidered: rows.length,
      totalOnHold,
    },
    rows,
  };
}
