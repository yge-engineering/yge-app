// Portfolio W-9 freshness watch by month.
//
// Plain English: walk every 1099-reportable vendor with a W-9
// on file + a w9CollectedOn date, compute the IRS 3-year
// refresh deadline (collectedOn + 3 years), then bucket by
// yyyy-mm of that deadline. Drives the W-9 refresh calendar
// the bookkeeper uses each quarter to chase stale forms before
// 1099 mailing season.
//
// Per row: month, total, distinctVendors, byKind.
//
// Sort: month asc.
//
// Different from vendor-w9-chase (current chase list) and
// vendor-w9-by-collected-monthly (input cadence). This is the
// output schedule.
//
// Pure derivation. No persisted records.

import type { Vendor, VendorKind } from './vendor';

export interface PortfolioW9MonthlyExpiringRow {
  month: string;
  total: number;
  distinctVendors: number;
  byKind: Partial<Record<VendorKind, number>>;
}

export interface PortfolioW9MonthlyExpiringRollup {
  monthsConsidered: number;
  totalW9s: number;
  noCollectedDateSkipped: number;
  noW9Skipped: number;
  notReportableSkipped: number;
}

export interface PortfolioW9MonthlyExpiringInputs {
  vendors: Vendor[];
  fromMonth?: string;
  toMonth?: string;
}

const REFRESH_YEARS = 3;

function addYears(yyyymmdd: string, years: number): string {
  const [yStr, mStr, dStr] = yyyymmdd.split('-');
  const y = Number(yStr ?? '0') + years;
  const m = Number(mStr ?? '0');
  const d = Number(dStr ?? '0');
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function buildPortfolioW9MonthlyExpiring(
  inputs: PortfolioW9MonthlyExpiringInputs,
): {
  rollup: PortfolioW9MonthlyExpiringRollup;
  rows: PortfolioW9MonthlyExpiringRow[];
} {
  type Acc = {
    month: string;
    total: number;
    vendors: Set<string>;
    byKind: Map<VendorKind, number>;
  };
  const accs = new Map<string, Acc>();

  let totalW9s = 0;
  let noCollectedDateSkipped = 0;
  let noW9Skipped = 0;
  let notReportableSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) {
      notReportableSkipped += 1;
      continue;
    }
    if (!v.w9OnFile) {
      noW9Skipped += 1;
      continue;
    }
    if (!v.w9CollectedOn || !/^\d{4}-\d{2}-\d{2}$/.test(v.w9CollectedOn)) {
      noCollectedDateSkipped += 1;
      continue;
    }
    const refreshDate = addYears(v.w9CollectedOn, REFRESH_YEARS);
    const month = refreshDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = { month, total: 0, vendors: new Set(), byKind: new Map() };
      accs.set(month, a);
    }
    a.total += 1;
    a.vendors.add(v.id);
    a.byKind.set(v.kind, (a.byKind.get(v.kind) ?? 0) + 1);
    totalW9s += 1;
  }

  const rows: PortfolioW9MonthlyExpiringRow[] = [...accs.values()]
    .map((a) => {
      const byKind: Partial<Record<VendorKind, number>> = {};
      for (const [k, v] of a.byKind) byKind[k] = v;
      return {
        month: a.month,
        total: a.total,
        distinctVendors: a.vendors.size,
        byKind,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalW9s,
      noCollectedDateSkipped,
      noW9Skipped,
      notReportableSkipped,
    },
    rows,
  };
}
