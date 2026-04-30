// Portfolio certification snapshot (point-in-time).
//
// Plain English: as-of today, count active employees' certs
// — total, current, expiring within 60 days, expired. Drives
// the right-now cert-watch overview.
//
// Pure derivation. No persisted records.

import type { CertificationKind, Employee } from './employee';

export interface PortfolioCertSnapshotResult {
  totalCerts: number;
  currentCerts: number;
  expiringSoonCerts: number;
  expiredCerts: number;
  byKind: Partial<Record<CertificationKind, number>>;
  activeEmployeesWithAnyCert: number;
}

export interface PortfolioCertSnapshotInputs {
  employees: Employee[];
  /** Reference 'now'. Defaults to today. */
  asOf?: Date;
  /** Days-to-expiry threshold for "soon". Defaults to 60. */
  soonDays?: number;
}

const MS_PER_DAY = 86_400_000;

export function buildPortfolioCertSnapshot(
  inputs: PortfolioCertSnapshotInputs,
): PortfolioCertSnapshotResult {
  const asOf = inputs.asOf ?? new Date();
  const soonDays = inputs.soonDays ?? 60;
  const soonCutoff = new Date(asOf.getTime() + soonDays * MS_PER_DAY);

  let totalCerts = 0;
  let currentCerts = 0;
  let expiringSoonCerts = 0;
  let expiredCerts = 0;
  const byKind = new Map<CertificationKind, number>();
  const activeWithCert = new Set<string>();

  for (const e of inputs.employees) {
    if ((e.status ?? 'ACTIVE') !== 'ACTIVE') continue;
    const certs = e.certifications ?? [];
    if (certs.length > 0) activeWithCert.add(e.id);
    for (const cert of certs) {
      totalCerts += 1;
      byKind.set(cert.kind, (byKind.get(cert.kind) ?? 0) + 1);
      if (!cert.expiresOn) {
        currentCerts += 1;
        continue;
      }
      const exp = new Date(`${cert.expiresOn}T23:59:59Z`);
      if (exp.getTime() < asOf.getTime()) expiredCerts += 1;
      else if (exp.getTime() <= soonCutoff.getTime()) expiringSoonCerts += 1;
      else currentCerts += 1;
    }
  }

  const out: Partial<Record<CertificationKind, number>> = {};
  for (const [k, v] of byKind) out[k] = v;

  return {
    totalCerts,
    currentCerts,
    expiringSoonCerts,
    expiredCerts,
    byKind: out,
    activeEmployeesWithAnyCert: activeWithCert.size,
  };
}
