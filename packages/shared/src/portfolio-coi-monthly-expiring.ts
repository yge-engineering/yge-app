// Portfolio subcontractor COI expiry by month.
//
// Plain English: walk every SUBCONTRACTOR vendor with a COI on
// file, bucket by yyyy-mm of coiExpiresOn. Counts COIs coming
// due each month. Drives the "what's expiring this quarter"
// COI chase calendar.
//
// Per row: month, total, distinctVendors, onHoldCount.
//
// Sort: month asc.
//
// Different from vendor-coi-aging (per-vendor age list),
// vendor-coi-monthly-expiring (alternative shape — same idea).
// This is the lean monthly count used on dashboards.
//
// Pure derivation. No persisted records.

import type { Vendor } from './vendor';

export interface PortfolioCoiMonthlyExpiringRow {
  month: string;
  total: number;
  distinctVendors: number;
  onHoldCount: number;
}

export interface PortfolioCoiMonthlyExpiringRollup {
  monthsConsidered: number;
  totalCois: number;
  noExpirySkipped: number;
  noCoiOnFileSkipped: number;
  nonSubSkipped: number;
}

export interface PortfolioCoiMonthlyExpiringInputs {
  vendors: Vendor[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioCoiMonthlyExpiring(
  inputs: PortfolioCoiMonthlyExpiringInputs,
): {
  rollup: PortfolioCoiMonthlyExpiringRollup;
  rows: PortfolioCoiMonthlyExpiringRow[];
} {
  type Acc = {
    month: string;
    total: number;
    vendors: Set<string>;
    onHoldCount: number;
  };
  const accs = new Map<string, Acc>();

  let totalCois = 0;
  let noExpirySkipped = 0;
  let noCoiOnFileSkipped = 0;
  let nonSubSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const v of inputs.vendors) {
    if (v.kind !== 'SUBCONTRACTOR') {
      nonSubSkipped += 1;
      continue;
    }
    if (!v.coiOnFile) {
      noCoiOnFileSkipped += 1;
      continue;
    }
    if (!v.coiExpiresOn) {
      noExpirySkipped += 1;
      continue;
    }
    const month = v.coiExpiresOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = { month, total: 0, vendors: new Set(), onHoldCount: 0 };
      accs.set(month, a);
    }
    a.total += 1;
    a.vendors.add(v.id);
    if (v.onHold === true) a.onHoldCount += 1;
    totalCois += 1;
  }

  const rows: PortfolioCoiMonthlyExpiringRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      total: a.total,
      distinctVendors: a.vendors.size,
      onHoldCount: a.onHoldCount,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalCois,
      noExpirySkipped,
      noCoiOnFileSkipped,
      nonSubSkipped,
    },
    rows,
  };
}
