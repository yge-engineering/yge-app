// Employee-anchored cert snapshot.
//
// Plain English: for one employee, as-of today, walk their
// certifications, count current/expiring-soon/expired/lifetime,
// kind mix, surface earliest-expiring + cert names. Drives the
// right-now per-employee credential overview.
//
// Pure derivation. No persisted records.

import type { CertificationKind, Employee } from './employee';

export interface EmployeeCertSnapshotResult {
  asOf: string;
  employeeId: string;
  totalCerts: number;
  currentCerts: number;
  expiringSoonCerts: number;
  expiredCerts: number;
  lifetimeCerts: number;
  byKind: Partial<Record<CertificationKind, number>>;
  earliestExpiringDate: string | null;
  expiringSoonWindowDays: number;
}

export interface EmployeeCertSnapshotInputs {
  employee: Employee | undefined;
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Days from asOf to count "expiring soon" (default 60). */
  expiringSoonWindowDays?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildEmployeeCertSnapshot(
  inputs: EmployeeCertSnapshotInputs,
): EmployeeCertSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const window = inputs.expiringSoonWindowDays ?? 60;
  const soonCutoff = addDays(asOf, window);

  const byKind = new Map<CertificationKind, number>();
  let totalCerts = 0;
  let currentCerts = 0;
  let expiringSoonCerts = 0;
  let expiredCerts = 0;
  let lifetimeCerts = 0;
  let earliestExpiringDate: string | null = null;

  const certs = inputs.employee?.certifications ?? [];
  for (const c of certs) {
    totalCerts += 1;
    byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
    if (!c.expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(c.expiresOn)) {
      lifetimeCerts += 1;
      continue;
    }
    if (c.expiresOn < asOf) {
      expiredCerts += 1;
    } else if (c.expiresOn <= soonCutoff) {
      expiringSoonCerts += 1;
      currentCerts += 1;
    } else {
      currentCerts += 1;
    }
    if (earliestExpiringDate == null || c.expiresOn < earliestExpiringDate) {
      earliestExpiringDate = c.expiresOn;
    }
  }

  const out: Partial<Record<CertificationKind, number>> = {};
  for (const [k, v] of byKind) out[k] = v;

  return {
    asOf,
    employeeId: inputs.employee?.id ?? '',
    totalCerts,
    currentCerts,
    expiringSoonCerts,
    expiredCerts,
    lifetimeCerts,
    byKind: out,
    earliestExpiringDate,
    expiringSoonWindowDays: window,
  };
}
