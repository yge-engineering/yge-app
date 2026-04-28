// Employee count by role.
//
// Plain English: roll the employee table up by EmployeeRole
// (OWNER, OFFICE, PROJECT_MANAGER, SUPERINTENDENT, FOREMAN,
// OPERATOR, TRUCK_DRIVER, LABORER, MECHANIC, APPRENTICE,
// OTHER). Within each role, count by employment status (active,
// on leave, laid off, terminated). Useful for HR + workforce
// planning reviews.
//
// Per row: role, total, active, onLeave, laidOff, terminated.
//
// Sort: OWNER, OFFICE, PROJECT_MANAGER, SUPERINTENDENT, FOREMAN,
// OPERATOR, TRUCK_DRIVER, LABORER, MECHANIC, APPRENTICE, OTHER.
//
// Different from employee-status-mix (per status, classification
// breakdown), employee-classification-mix (per employee distinct
// classifications), and employee-foreman-roster (crew by
// foreman). This is the role view.
//
// Pure derivation. No persisted records.

import type { Employee, EmployeeRole } from './employee';

export interface EmployeeByRoleRow {
  role: EmployeeRole;
  total: number;
  active: number;
  onLeave: number;
  laidOff: number;
  terminated: number;
}

export interface EmployeeByRoleRollup {
  rolesConsidered: number;
  totalEmployees: number;
  totalActive: number;
}

export interface EmployeeByRoleInputs {
  employees: Employee[];
}

const ROLE_ORDER: EmployeeRole[] = [
  'OWNER',
  'OFFICE',
  'PROJECT_MANAGER',
  'SUPERINTENDENT',
  'FOREMAN',
  'OPERATOR',
  'TRUCK_DRIVER',
  'LABORER',
  'MECHANIC',
  'APPRENTICE',
  'OTHER',
];

export function buildEmployeeByRole(
  inputs: EmployeeByRoleInputs,
): {
  rollup: EmployeeByRoleRollup;
  rows: EmployeeByRoleRow[];
} {
  type Acc = {
    total: number;
    active: number;
    onLeave: number;
    laidOff: number;
    terminated: number;
  };
  const accs = new Map<EmployeeRole, Acc>();
  let portfolioActive = 0;

  for (const e of inputs.employees) {
    const acc = accs.get(e.role) ?? {
      total: 0,
      active: 0,
      onLeave: 0,
      laidOff: 0,
      terminated: 0,
    };
    acc.total += 1;
    if (e.status === 'ACTIVE') {
      acc.active += 1;
      portfolioActive += 1;
    } else if (e.status === 'ON_LEAVE') acc.onLeave += 1;
    else if (e.status === 'LAID_OFF') acc.laidOff += 1;
    else if (e.status === 'TERMINATED') acc.terminated += 1;
    accs.set(e.role, acc);
  }

  const rows: EmployeeByRoleRow[] = [];
  for (const role of ROLE_ORDER) {
    const acc = accs.get(role);
    if (!acc) continue;
    rows.push({
      role,
      total: acc.total,
      active: acc.active,
      onLeave: acc.onLeave,
      laidOff: acc.laidOff,
      terminated: acc.terminated,
    });
  }

  return {
    rollup: {
      rolesConsidered: rows.length,
      totalEmployees: inputs.employees.length,
      totalActive: portfolioActive,
    },
    rows,
  };
}
