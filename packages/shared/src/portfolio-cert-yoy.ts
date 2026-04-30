// Portfolio employee certification expiry year-over-year.
//
// Plain English: collapse two years of cert expiry deadlines
// for active employees into a comparison row with kind mix +
// delta. Sized for the year-end "how many renewals across the
// crew next year" planning.
//
// Different from portfolio-cert-monthly-expiring (per month).
//
// Pure derivation. No persisted records.

import type { CertificationKind, Employee } from './employee';

export interface PortfolioCertYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByKind: Partial<Record<CertificationKind, number>>;
  currentTotal: number;
  currentByKind: Partial<Record<CertificationKind, number>>;
  totalDelta: number;
}

export interface PortfolioCertYoyInputs {
  employees: Employee[];
  currentYear: number;
}

export function buildPortfolioCertYoy(
  inputs: PortfolioCertYoyInputs,
): PortfolioCertYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = { total: number; byKind: Map<CertificationKind, number> };
  function emptyBucket(): Bucket {
    return { total: 0, byKind: new Map() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const e of inputs.employees) {
    if ((e.status ?? 'ACTIVE') !== 'ACTIVE') continue;
    for (const cert of e.certifications ?? []) {
      if (!cert.expiresOn) continue;
      const year = Number(cert.expiresOn.slice(0, 4));
      let b: Bucket | null = null;
      if (year === priorYear) b = prior;
      else if (year === inputs.currentYear) b = current;
      if (!b) continue;
      b.total += 1;
      b.byKind.set(cert.kind, (b.byKind.get(cert.kind) ?? 0) + 1);
    }
  }

  function toRecord(m: Map<CertificationKind, number>): Partial<Record<CertificationKind, number>> {
    const out: Partial<Record<CertificationKind, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByKind: toRecord(prior.byKind),
    currentTotal: current.total,
    currentByKind: toRecord(current.byKind),
    totalDelta: current.total - prior.total,
  };
}
