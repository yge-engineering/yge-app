// Portfolio employee snapshot.
//
// Plain English: point-in-time count of every employee on the
// roster, broken down by status, role, and DIR classification.
// Drives the right-now headcount overview.
//
// Pure derivation. No persisted records.

import type {
  DirClassification,
  Employee,
  EmployeeRole,
  EmploymentStatus,
} from './employee';

export interface PortfolioEmployeeSnapshotResult {
  totalEmployees: number;
  byStatus: Partial<Record<EmploymentStatus, number>>;
  byRole: Partial<Record<EmployeeRole, number>>;
  byClassification: Partial<Record<DirClassification, number>>;
  activeCount: number;
}

export interface PortfolioEmployeeSnapshotInputs {
  employees: Employee[];
}

export function buildPortfolioEmployeeSnapshot(
  inputs: PortfolioEmployeeSnapshotInputs,
): PortfolioEmployeeSnapshotResult {
  const byStatus = new Map<EmploymentStatus, number>();
  const byRole = new Map<EmployeeRole, number>();
  const byClassification = new Map<DirClassification, number>();
  let activeCount = 0;

  for (const e of inputs.employees) {
    const status: EmploymentStatus = e.status ?? 'ACTIVE';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byRole.set(e.role, (byRole.get(e.role) ?? 0) + 1);
    const klass: DirClassification = e.classification ?? 'NOT_APPLICABLE';
    byClassification.set(klass, (byClassification.get(klass) ?? 0) + 1);
    if (status === 'ACTIVE') activeCount += 1;
  }

  function statusRecord(m: Map<EmploymentStatus, number>): Partial<Record<EmploymentStatus, number>> {
    const out: Partial<Record<EmploymentStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function roleRecord(m: Map<EmployeeRole, number>): Partial<Record<EmployeeRole, number>> {
    const out: Partial<Record<EmployeeRole, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function classRecord(m: Map<DirClassification, number>): Partial<Record<DirClassification, number>> {
    const out: Partial<Record<DirClassification, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    totalEmployees: inputs.employees.length,
    byStatus: statusRecord(byStatus),
    byRole: roleRecord(byRole),
    byClassification: classRecord(byClassification),
    activeCount,
  };
}
