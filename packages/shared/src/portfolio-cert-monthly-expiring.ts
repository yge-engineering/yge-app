// Portfolio employee certification expiry by month.
//
// Plain English: walk every active employee's certifications,
// bucket by yyyy-mm of expiresOn. Counts certifications coming
// due each month, breaks down by CertificationKind. Drives the
// "what's expiring this quarter" calendar.
//
// Per row: month, total, byKind.
//
// Sort: month asc.
//
// Different from cert-watchlist (per-cert detail list),
// employee-cert-by-month-expiring (alternative view, may have
// different shape).
//
// Pure derivation. No persisted records.

import type { CertificationKind, Employee } from './employee';

export interface PortfolioCertMonthlyExpiringRow {
  month: string;
  total: number;
  byKind: Partial<Record<CertificationKind, number>>;
}

export interface PortfolioCertMonthlyExpiringRollup {
  monthsConsidered: number;
  totalCerts: number;
  noExpirySkipped: number;
  noActiveSkipped: number;
}

export interface PortfolioCertMonthlyExpiringInputs {
  employees: Employee[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioCertMonthlyExpiring(
  inputs: PortfolioCertMonthlyExpiringInputs,
): {
  rollup: PortfolioCertMonthlyExpiringRollup;
  rows: PortfolioCertMonthlyExpiringRow[];
} {
  type Acc = {
    month: string;
    total: number;
    byKind: Map<CertificationKind, number>;
  };
  const accs = new Map<string, Acc>();

  let totalCerts = 0;
  let noExpirySkipped = 0;
  let noActiveSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const e of inputs.employees) {
    const status = e.status ?? 'ACTIVE';
    if (status !== 'ACTIVE') {
      noActiveSkipped += 1;
      continue;
    }
    for (const cert of e.certifications ?? []) {
      if (!cert.expiresOn) {
        noExpirySkipped += 1;
        continue;
      }
      const month = cert.expiresOn.slice(0, 7);
      if (fromM && month < fromM) continue;
      if (toM && month > toM) continue;

      let a = accs.get(month);
      if (!a) {
        a = { month, total: 0, byKind: new Map() };
        accs.set(month, a);
      }
      a.total += 1;
      a.byKind.set(cert.kind, (a.byKind.get(cert.kind) ?? 0) + 1);
      totalCerts += 1;
    }
  }

  const rows: PortfolioCertMonthlyExpiringRow[] = [...accs.values()]
    .map((a) => {
      const byKind: Partial<Record<CertificationKind, number>> = {};
      for (const [k, v] of a.byKind) byKind[k] = v;
      return { month: a.month, total: a.total, byKind };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalCerts,
      noExpirySkipped,
      noActiveSkipped,
    },
    rows,
  };
}
