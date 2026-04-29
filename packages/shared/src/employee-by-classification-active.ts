// Active workforce by DIR classification.
//
// Plain English: roll the ACTIVE-status workforce up by DIR
// classification (OPERATING_ENGINEER_GROUP_1..5, TEAMSTER_*,
// LABORER_*, CARPENTER, CEMENT_MASON, IRONWORKER, etc.). Useful
// for the "do we have enough Group-3 operators to staff this
// pursuit" check.
//
// Per row: classification, label, count, byRole.
//
// Sort by count desc.
//
// Different from employee-classification-mix (per-employee
// distinct classifications), employee-status-mix (per status,
// classification breakdown), employee-by-role (per role).
// This is the active-only classification head-count.
//
// Pure derivation. No persisted records.

import type {
  DirClassification,
  Employee,
  EmployeeRole,
} from './employee';
import { classificationLabel } from './employee';

export interface EmployeeByClassificationActiveRow {
  classification: DirClassification;
  label: string;
  count: number;
  byRole: Partial<Record<EmployeeRole, number>>;
}

export interface EmployeeByClassificationActiveRollup {
  classificationsConsidered: number;
  totalActive: number;
}

export interface EmployeeByClassificationActiveInputs {
  employees: Employee[];
}

export function buildEmployeeByClassificationActive(
  inputs: EmployeeByClassificationActiveInputs,
): {
  rollup: EmployeeByClassificationActiveRollup;
  rows: EmployeeByClassificationActiveRow[];
} {
  type Acc = {
    count: number;
    roles: Map<EmployeeRole, number>;
  };
  const accs = new Map<DirClassification, Acc>();
  let totalActive = 0;

  for (const e of inputs.employees) {
    if (e.status !== 'ACTIVE') continue;
    totalActive += 1;
    const acc = accs.get(e.classification) ?? {
      count: 0,
      roles: new Map<EmployeeRole, number>(),
    };
    acc.count += 1;
    acc.roles.set(e.role, (acc.roles.get(e.role) ?? 0) + 1);
    accs.set(e.classification, acc);
  }

  const rows: EmployeeByClassificationActiveRow[] = [];
  for (const [classification, acc] of accs.entries()) {
    const obj: Partial<Record<EmployeeRole, number>> = {};
    for (const [k, v] of acc.roles.entries()) obj[k] = v;
    rows.push({
      classification,
      label: classificationLabel(classification),
      count: acc.count,
      byRole: obj,
    });
  }

  rows.sort((a, b) => b.count - a.count);

  return {
    rollup: {
      classificationsConsidered: rows.length,
      totalActive,
    },
    rows,
  };
}
