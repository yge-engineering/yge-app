// Portfolio headcount snapshot.
//
// Plain English: as-of today, count active employees, break down
// by role + DIR classification + employment status, count
// foremen + operators + laborers + apprentices, count distinct
// foremen referenced. Drives the right-now crew-roster overview.
//
// Pure derivation. No persisted records.

import type { DirClassification, Employee, EmployeeRole, EmploymentStatus } from './employee';

export interface PortfolioHeadcountSnapshotResult {
  asOf: string;
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  laidOffEmployees: number;
  terminatedEmployees: number;
  foremanCount: number;
  operatorCount: number;
  laborerCount: number;
  apprenticeCount: number;
  byRole: Partial<Record<EmployeeRole, number>>;
  byClassification: Partial<Record<DirClassification, number>>;
  byStatus: Partial<Record<EmploymentStatus, number>>;
  distinctForemen: number;
}

export interface PortfolioHeadcountSnapshotInputs {
  employees: Employee[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioHeadcountSnapshot(
  inputs: PortfolioHeadcountSnapshotInputs,
): PortfolioHeadcountSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byRole = new Map<EmployeeRole, number>();
  const byClassification = new Map<DirClassification, number>();
  const byStatus = new Map<EmploymentStatus, number>();
  const foremen = new Set<string>();

  let totalEmployees = 0;
  let activeEmployees = 0;
  let onLeaveEmployees = 0;
  let laidOffEmployees = 0;
  let terminatedEmployees = 0;
  let foremanCount = 0;
  let operatorCount = 0;
  let laborerCount = 0;
  let apprenticeCount = 0;

  for (const e of inputs.employees) {
    if (e.hiredOn && /^\d{4}-\d{2}-\d{2}$/.test(e.hiredOn) && e.hiredOn > asOf) continue;
    totalEmployees += 1;
    const status: EmploymentStatus = e.status ?? 'ACTIVE';
    if (status === 'ACTIVE') activeEmployees += 1;
    else if (status === 'ON_LEAVE') onLeaveEmployees += 1;
    else if (status === 'LAID_OFF') laidOffEmployees += 1;
    else if (status === 'TERMINATED') terminatedEmployees += 1;
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byRole.set(e.role, (byRole.get(e.role) ?? 0) + 1);
    byClassification.set(e.classification, (byClassification.get(e.classification) ?? 0) + 1);
    if (e.role === 'FOREMAN') foremanCount += 1;
    else if (e.role === 'OPERATOR') operatorCount += 1;
    else if (e.role === 'LABORER') laborerCount += 1;
    else if (e.role === 'APPRENTICE') apprenticeCount += 1;
    if (e.foremanId) foremen.add(e.foremanId);
  }

  const rOut: Partial<Record<EmployeeRole, number>> = {};
  for (const [k, v] of byRole) rOut[k] = v;
  const cOut: Partial<Record<DirClassification, number>> = {};
  for (const [k, v] of byClassification) cOut[k] = v;
  const sOut: Partial<Record<EmploymentStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;

  return {
    asOf,
    totalEmployees,
    activeEmployees,
    onLeaveEmployees,
    laidOffEmployees,
    terminatedEmployees,
    foremanCount,
    operatorCount,
    laborerCount,
    apprenticeCount,
    byRole: rOut,
    byClassification: cOut,
    byStatus: sOut,
    distinctForemen: foremen.size,
  };
}
