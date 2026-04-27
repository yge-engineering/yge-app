// Per-employee certification expiration board.
//
// Plain English: a foreman can't put a guy with a lapsed CDL behind
// the wheel. A laborer with an expired OSHA-10 can't be on a public
// works job for very long without a fine. Most certs renew on a
// schedule (CDL every 5 years, OSHA-10 lifetime, FIRST_AID_CPR
// every 2 years, FORKLIFT every 3 years, TRAFFIC_CONTROL annual,
// CRANE_OPERATOR every 5 years, etc.). Each individual cert carries
// its own expiresOn (lifetime certs leave it blank).
//
// This walks ACTIVE employee certs, classifies each by days-to-
// expire, and rolls up:
//   - per-employee summary (most-urgent cert + count by tier)
//   - per-cert-kind summary (which certs have the most lapses)
//
// Pure derivation. No persisted records.

import type {
  CertificationKind,
  Employee,
  EmployeeCertification,
} from './employee';

export type CertWindowFlag =
  | 'EXPIRED'
  | 'EXPIRING_30'
  | 'EXPIRING_60'
  | 'EXPIRING_90'
  | 'CURRENT'
  | 'LIFETIME';

export interface EmployeeCertBoardCert {
  kind: CertificationKind;
  label: string;
  expiresOn: string | null;
  daysToExpire: number | null;
  flag: CertWindowFlag;
}

export interface EmployeeCertBoardRow {
  employeeId: string;
  employeeName: string;
  certCount: number;
  expiredCount: number;
  expiring30Count: number;
  expiring60Count: number;
  expiring90Count: number;
  /** Most-urgent cert across the employee's roster (EXPIRED first,
   *  then EXPIRING_30, etc.). */
  worstCert: EmployeeCertBoardCert | null;
  certs: EmployeeCertBoardCert[];
}

export interface CertBoardKindRollup {
  kind: CertificationKind;
  totalEmployees: number;
  expired: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
}

export interface EmployeeCertBoardRollup {
  employeesConsidered: number;
  totalCerts: number;
  totalExpired: number;
  totalExpiring30: number;
  totalExpiring60: number;
  totalExpiring90: number;
  byKind: CertBoardKindRollup[];
}

export interface EmployeeCertBoardInputs {
  asOf?: string;
  employees: Employee[];
}

const TIER_RANK: Record<CertWindowFlag, number> = {
  EXPIRED: 0,
  EXPIRING_30: 1,
  EXPIRING_60: 2,
  EXPIRING_90: 3,
  CURRENT: 4,
  LIFETIME: 5,
};

export function buildEmployeeCertBoard(
  inputs: EmployeeCertBoardInputs,
): {
  rollup: EmployeeCertBoardRollup;
  rows: EmployeeCertBoardRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);

  const rows: EmployeeCertBoardRow[] = [];
  let totalExpired = 0;
  let totalExp30 = 0;
  let totalExp60 = 0;
  let totalExp90 = 0;
  let totalCerts = 0;

  type KindBucket = {
    kind: CertificationKind;
    totalEmployees: Set<string>;
    expired: number;
    exp30: number;
    exp60: number;
    exp90: number;
  };
  const byKind = new Map<CertificationKind, KindBucket>();

  for (const e of inputs.employees) {
    if (e.status !== 'ACTIVE') continue;
    const certs = e.certifications ?? [];
    const certRows: EmployeeCertBoardCert[] = [];
    let exp = 0;
    let e30 = 0;
    let e60 = 0;
    let e90 = 0;

    for (const c of certs) {
      const flag = classify(c, refNow);
      const expDate = c.expiresOn ? parseDate(c.expiresOn) : null;
      const days = expDate ? daysBetween(refNow, expDate) : null;
      const certRow: EmployeeCertBoardCert = {
        kind: c.kind,
        label: c.label,
        expiresOn: c.expiresOn ?? null,
        daysToExpire: days,
        flag,
      };
      certRows.push(certRow);
      totalCerts += 1;

      const k = byKind.get(c.kind) ?? {
        kind: c.kind,
        totalEmployees: new Set<string>(),
        expired: 0,
        exp30: 0,
        exp60: 0,
        exp90: 0,
      };
      k.totalEmployees.add(e.id);
      if (flag === 'EXPIRED') {
        exp += 1;
        k.expired += 1;
        totalExpired += 1;
      } else if (flag === 'EXPIRING_30') {
        e30 += 1;
        k.exp30 += 1;
        totalExp30 += 1;
      } else if (flag === 'EXPIRING_60') {
        e60 += 1;
        k.exp60 += 1;
        totalExp60 += 1;
      } else if (flag === 'EXPIRING_90') {
        e90 += 1;
        k.exp90 += 1;
        totalExp90 += 1;
      }
      byKind.set(c.kind, k);
    }

    certRows.sort((a, b) => TIER_RANK[a.flag] - TIER_RANK[b.flag]);
    const worst = certRows[0] ?? null;

    rows.push({
      employeeId: e.id,
      employeeName: `${e.firstName} ${e.lastName}`.trim(),
      certCount: certs.length,
      expiredCount: exp,
      expiring30Count: e30,
      expiring60Count: e60,
      expiring90Count: e90,
      worstCert: worst,
      certs: certRows,
    });
  }

  // Most-urgent employees first (EXPIRED count desc, then 30, 60, 90).
  rows.sort((a, b) => {
    if (a.expiredCount !== b.expiredCount) return b.expiredCount - a.expiredCount;
    if (a.expiring30Count !== b.expiring30Count) return b.expiring30Count - a.expiring30Count;
    if (a.expiring60Count !== b.expiring60Count) return b.expiring60Count - a.expiring60Count;
    return b.expiring90Count - a.expiring90Count;
  });

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalCerts,
      totalExpired,
      totalExpiring30: totalExp30,
      totalExpiring60: totalExp60,
      totalExpiring90: totalExp90,
      byKind: Array.from(byKind.values())
        .map((k) => ({
          kind: k.kind,
          totalEmployees: k.totalEmployees.size,
          expired: k.expired,
          expiring30: k.exp30,
          expiring60: k.exp60,
          expiring90: k.exp90,
        }))
        .sort(
          (a, b) =>
            b.expired + b.expiring30 - (a.expired + a.expiring30),
        ),
    },
    rows,
  };
}

function classify(cert: EmployeeCertification, refNow: Date): CertWindowFlag {
  if (!cert.expiresOn) return 'LIFETIME';
  const expDate = parseDate(cert.expiresOn);
  if (!expDate) return 'LIFETIME';
  const days = daysBetween(refNow, expDate);
  if (days < 0) return 'EXPIRED';
  if (days <= 30) return 'EXPIRING_30';
  if (days <= 60) return 'EXPIRING_60';
  if (days <= 90) return 'EXPIRING_90';
  return 'CURRENT';
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
