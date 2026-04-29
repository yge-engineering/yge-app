// Employee certs expiring by month.
//
// Plain English: bucket every active-employee cert with an
// expiresOn by yyyy-mm of expiry — gives the upcoming-renewal
// calendar in long format. Drives the "look 6 months out, see
// who's coming due" view.
//
// Per row: month, total, byKind, distinctEmployees.
//
// Sort by month asc.
//
// Lifetime certs (no expiresOn) and expired certs (already past)
// both excluded. Use cert-renewal-calendar for the list-form
// per-cert view.
//
// Pure derivation. No persisted records.

import type { CertificationKind, Employee } from './employee';

export interface EmployeeCertByMonthExpiringRow {
  month: string;
  total: number;
  byKind: Partial<Record<CertificationKind, number>>;
  distinctEmployees: number;
}

export interface EmployeeCertByMonthExpiringRollup {
  monthsConsidered: number;
  totalCerts: number;
}

export interface EmployeeCertByMonthExpiringInputs {
  employees: Employee[];
  /** Reference 'now' as yyyy-mm-dd. Defaults to today. */
  asOf?: string;
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildEmployeeCertByMonthExpiring(
  inputs: EmployeeCertByMonthExpiringInputs,
): {
  rollup: EmployeeCertByMonthExpiringRollup;
  rows: EmployeeCertByMonthExpiringRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  type Bucket = {
    month: string;
    total: number;
    byKind: Map<CertificationKind, number>;
    employees: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    total: 0,
    byKind: new Map<CertificationKind, number>(),
    employees: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const e of inputs.employees) {
    if (e.status !== 'ACTIVE') continue;
    for (const cert of e.certifications) {
      if (!cert.expiresOn) continue;
      if (cert.expiresOn < asOf) continue;
      const month = cert.expiresOn.slice(0, 7);
      if (month.length < 7) continue;
      if (inputs.fromMonth && month < inputs.fromMonth) continue;
      if (inputs.toMonth && month > inputs.toMonth) continue;
      const b = buckets.get(month) ?? fresh(month);
      b.total += 1;
      b.byKind.set(cert.kind, (b.byKind.get(cert.kind) ?? 0) + 1);
      b.employees.add(e.id);
      buckets.set(month, b);
    }
  }

  const rows: EmployeeCertByMonthExpiringRow[] = Array.from(buckets.values())
    .map((b) => {
      const obj: Partial<Record<CertificationKind, number>> = {};
      for (const [k, v] of b.byKind.entries()) obj[k] = v;
      return {
        month: b.month,
        total: b.total,
        byKind: obj,
        distinctEmployees: b.employees.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let totalCerts = 0;
  for (const r of rows) totalCerts += r.total;

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalCerts,
    },
    rows,
  };
}
