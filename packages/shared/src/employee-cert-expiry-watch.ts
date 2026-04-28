// Per-employee certification expiry watchlist.
//
// Plain English: every employee's cert list (CDL, OSHA-30,
// First Aid, etc) carries an optional expiresOn. Walk every
// ACTIVE employee's certifications and bucket each cert by
// urgency vs asOf:
//   EXPIRED, EXPIRING_30, EXPIRING_60, EXPIRING_90, CURRENT,
//   LIFETIME (no expiry).
//
// Per-employee row: count of certs in each bucket + worst tier
// across all their certs.
//
// Different from cert-renewal-calendar (timeline view) and
// employee-cert-board (snapshot list). This is the per-employee
// 'who has what coming due' actionable list, sorted worst-first.
//
// Pure derivation. No persisted records.

import type { Employee } from './employee';

export type CertExpiryTier =
  | 'EXPIRED'
  | 'EXPIRING_30'
  | 'EXPIRING_60'
  | 'EXPIRING_90'
  | 'CURRENT'
  | 'LIFETIME';

export interface EmployeeCertExpiryRow {
  employeeId: string;
  employeeName: string;
  totalCerts: number;
  expiredCount: number;
  expiring30Count: number;
  expiring60Count: number;
  expiring90Count: number;
  currentCount: number;
  lifetimeCount: number;
  /** Worst tier across this employee's cert list. */
  worstTier: CertExpiryTier;
}

export interface EmployeeCertExpiryRollup {
  employeesConsidered: number;
  totalCerts: number;
  totalExpired: number;
  totalExpiring30: number;
  totalExpiring60: number;
  totalExpiring90: number;
}

export interface EmployeeCertExpiryInputs {
  employees: Employee[];
  /** asOf yyyy-mm-dd. Defaults to '1970-01-01' (caller should
   *  always pass an actual date). */
  asOf: string;
  /** Default false — only ACTIVE employees scored. */
  includeInactive?: boolean;
}

export function buildEmployeeCertExpiryWatch(
  inputs: EmployeeCertExpiryInputs,
): {
  rollup: EmployeeCertExpiryRollup;
  rows: EmployeeCertExpiryRow[];
} {
  const includeInactive = inputs.includeInactive === true;

  let totalCerts = 0;
  let totalExpired = 0;
  let totalE30 = 0;
  let totalE60 = 0;
  let totalE90 = 0;

  const rows: EmployeeCertExpiryRow[] = [];
  for (const e of inputs.employees) {
    if (!includeInactive && e.status !== 'ACTIVE') continue;
    const certs = e.certifications ?? [];
    let expired = 0;
    let e30 = 0;
    let e60 = 0;
    let e90 = 0;
    let current = 0;
    let lifetime = 0;
    let worst: CertExpiryTier = 'LIFETIME';

    for (const cert of certs) {
      const tier = scoreTier(cert.expiresOn, inputs.asOf);
      if (tier === 'EXPIRED') expired += 1;
      else if (tier === 'EXPIRING_30') e30 += 1;
      else if (tier === 'EXPIRING_60') e60 += 1;
      else if (tier === 'EXPIRING_90') e90 += 1;
      else if (tier === 'CURRENT') current += 1;
      else lifetime += 1;
      if (tierRank(tier) < tierRank(worst)) worst = tier;
    }

    rows.push({
      employeeId: e.id,
      employeeName: nameOf(e),
      totalCerts: certs.length,
      expiredCount: expired,
      expiring30Count: e30,
      expiring60Count: e60,
      expiring90Count: e90,
      currentCount: current,
      lifetimeCount: lifetime,
      worstTier: worst,
    });

    totalCerts += certs.length;
    totalExpired += expired;
    totalE30 += e30;
    totalE60 += e60;
    totalE90 += e90;
  }

  // Sort: worst tier first.
  rows.sort((a, b) => {
    const ar = tierRank(a.worstTier);
    const br = tierRank(b.worstTier);
    if (ar !== br) return ar - br;
    if (a.expiredCount !== b.expiredCount) return b.expiredCount - a.expiredCount;
    return a.employeeName.localeCompare(b.employeeName);
  });

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalCerts,
      totalExpired,
      totalExpiring30: totalE30,
      totalExpiring60: totalE60,
      totalExpiring90: totalE90,
    },
    rows,
  };
}

function scoreTier(expiresOn: string | undefined, asOf: string): CertExpiryTier {
  if (!expiresOn) return 'LIFETIME';
  const days = daysBetween(asOf, expiresOn);
  if (days < 0) return 'EXPIRED';
  if (days <= 30) return 'EXPIRING_30';
  if (days <= 60) return 'EXPIRING_60';
  if (days <= 90) return 'EXPIRING_90';
  return 'CURRENT';
}

function tierRank(t: CertExpiryTier): number {
  switch (t) {
    case 'EXPIRED': return 0;
    case 'EXPIRING_30': return 1;
    case 'EXPIRING_60': return 2;
    case 'EXPIRING_90': return 3;
    case 'CURRENT': return 4;
    case 'LIFETIME': return 5;
  }
}

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function nameOf(e: Employee): string {
  if (e.displayName && e.displayName.trim().length > 0) {
    return `${e.displayName} ${e.lastName}`;
  }
  return `${e.firstName} ${e.lastName}`;
}
