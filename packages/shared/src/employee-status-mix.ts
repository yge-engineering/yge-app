// Employee status snapshot.
//
// Plain English: a heavy-civil contractor cycles a lot of crew on
// and off the books with the season — laying off operators when
// rain shuts dirtwork, calling them back when it dries. This rolls
// the current employee roster up by EmploymentStatus + DIR
// classification so HR + payroll can see the active pool, who's
// on leave, who's been laid off (still W-2 / I-9 retained), and
// who's terminated.
//
// Per row: status, total, byClassification mix.
//
// Sort: ACTIVE, ON_LEAVE, LAID_OFF, TERMINATED.
//
// Different from workforce-headcount-monthly (per-month who-was-
// on-DRs view), employee-tenure (per-employee tenure), and
// employee-classification-mix (per-employee distinct-class count).
// This is the current roster snapshot.
//
// Pure derivation. No persisted records.

import type {
  DirClassification,
  Employee,
  EmploymentStatus,
} from './employee';

export interface EmployeeStatusRow {
  status: EmploymentStatus;
  total: number;
  byClassification: Partial<Record<DirClassification, number>>;
}

export interface EmployeeStatusRollup {
  totalEmployees: number;
  activeCount: number;
  onLeaveCount: number;
  laidOffCount: number;
  terminatedCount: number;
}

export interface EmployeeStatusMixInputs {
  employees: Employee[];
}

const STATUS_ORDER: EmploymentStatus[] = [
  'ACTIVE',
  'ON_LEAVE',
  'LAID_OFF',
  'TERMINATED',
];

export function buildEmployeeStatusMix(
  inputs: EmployeeStatusMixInputs,
): {
  rollup: EmployeeStatusRollup;
  rows: EmployeeStatusRow[];
} {
  const counts = new Map<EmploymentStatus, Map<DirClassification, number>>();
  for (const status of STATUS_ORDER) counts.set(status, new Map());

  let active = 0;
  let onLeave = 0;
  let laidOff = 0;
  let terminated = 0;

  for (const e of inputs.employees) {
    const cls = counts.get(e.status);
    if (!cls) continue;
    cls.set(e.classification, (cls.get(e.classification) ?? 0) + 1);
    if (e.status === 'ACTIVE') active += 1;
    else if (e.status === 'ON_LEAVE') onLeave += 1;
    else if (e.status === 'LAID_OFF') laidOff += 1;
    else if (e.status === 'TERMINATED') terminated += 1;
  }

  const rows: EmployeeStatusRow[] = STATUS_ORDER.map((status) => {
    const map: Map<DirClassification, number> = counts.get(status) ?? new Map();
    let total = 0;
    const obj: Partial<Record<DirClassification, number>> = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
      total += v;
    }
    return { status, total, byClassification: obj };
  });

  return {
    rollup: {
      totalEmployees: inputs.employees.length,
      activeCount: active,
      onLeaveCount: onLeave,
      laidOffCount: laidOff,
      terminatedCount: terminated,
    },
    rows,
  };
}
