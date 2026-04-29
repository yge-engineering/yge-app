// Employee certification coverage by kind.
//
// Plain English: roll the active workforce up by CertificationKind
// (CDL_A / CDL_B / OSHA_10 / OSHA_30 / FIRST_AID_CPR / FORKLIFT /
// TRAFFIC_CONTROL / CONFINED_SPACE / CRANE_OPERATOR / HAZWOPER /
// OTHER) — how many active employees hold a current cert of each
// kind. The "do we have enough OSHA-30 supervisors to staff this
// pursuit" check.
//
// Per row: kind, label, holders (employees who have at least one
// of this cert kind, current or expired), currentHolders (cert
// not past expiresOn), expiringSoonHolders (within 60 days of
// expiry), expiredHolders.
//
// Sort by currentHolders desc.
//
// Different from cert-watchlist (per-cert expiring),
// employee-cert-board (per-employee summary),
// cert-renewal-calendar (per-cert expiry calendar). This is the
// portfolio coverage by kind.
//
// Pure derivation. No persisted records.

import type { CertificationKind, Employee } from './employee';
import { certKindLabel } from './employee';

export interface EmployeeCertCoverageRow {
  kind: CertificationKind;
  label: string;
  holders: number;
  currentHolders: number;
  expiringSoonHolders: number;
  expiredHolders: number;
}

export interface EmployeeCertCoverageRollup {
  kindsConsidered: number;
  activeWorkforce: number;
}

export interface EmployeeCertCoverageInputs {
  employees: Employee[];
  /** Reference 'now'. Defaults to today. */
  asOf?: Date;
  /** "Expires soon" window in days. Defaults to 60. */
  soonDays?: number;
}

export function buildEmployeeCertCoverageMix(
  inputs: EmployeeCertCoverageInputs,
): {
  rollup: EmployeeCertCoverageRollup;
  rows: EmployeeCertCoverageRow[];
} {
  const asOf = inputs.asOf ?? new Date();
  const soonDays = inputs.soonDays ?? 60;
  const soonMs = soonDays * 86_400_000;

  type Acc = {
    holders: Set<string>;
    current: Set<string>;
    soon: Set<string>;
    expired: Set<string>;
  };
  const accs = new Map<CertificationKind, Acc>();
  const get = (k: CertificationKind): Acc => {
    let a = accs.get(k);
    if (!a) {
      a = { holders: new Set(), current: new Set(), soon: new Set(), expired: new Set() };
      accs.set(k, a);
    }
    return a;
  };

  const activeEmps = inputs.employees.filter((e) => e.status === 'ACTIVE');

  for (const e of activeEmps) {
    for (const cert of e.certifications) {
      const acc = get(cert.kind);
      acc.holders.add(e.id);
      if (!cert.expiresOn) {
        // Lifetime cert (e.g. OSHA_30) — counts as current.
        acc.current.add(e.id);
        continue;
      }
      const t = Date.parse(cert.expiresOn + 'T23:59:59Z');
      if (Number.isNaN(t)) continue;
      const delta = t - asOf.getTime();
      if (delta < 0) acc.expired.add(e.id);
      else {
        acc.current.add(e.id);
        if (delta <= soonMs) acc.soon.add(e.id);
      }
    }
  }

  const rows: EmployeeCertCoverageRow[] = [];
  for (const [kind, acc] of accs.entries()) {
    rows.push({
      kind,
      label: certKindLabel(kind),
      holders: acc.holders.size,
      currentHolders: acc.current.size,
      expiringSoonHolders: acc.soon.size,
      expiredHolders: acc.expired.size,
    });
  }

  rows.sort((a, b) => b.currentHolders - a.currentHolders);

  return {
    rollup: {
      kindsConsidered: rows.length,
      activeWorkforce: activeEmps.length,
    },
    rows,
  };
}
