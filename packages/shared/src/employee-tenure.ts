// Employee tenure tracker.
//
// Plain English: how long has each active employee been with YGE?
// Drives anniversary-bonus planning, safety-orientation requirements
// (new hires need IIPP training in first 90 days), and retention
// reads ("our journeymen average 7 years; that's strong").
//
// Pure derivation. Uses Employee.createdAt as the tenure-start
// proxy. Phase 2 swaps in a real hireDate field when added.

import type { Employee } from './employee';
import { fullName } from './employee';

export type TenureTier =
  | 'NEW_HIRE'    // <90 days
  | 'UNDER_1_YR'
  | 'UNDER_3_YR'
  | 'UNDER_5_YR'
  | 'OVER_5_YR';

export interface EmployeeTenureRow {
  employeeId: string;
  employeeName: string;
  role: Employee['role'];
  daysWithYGE: number;
  yearsWithYGE: number;
  tier: TenureTier;
}

export interface EmployeeTenureRollup {
  total: number;
  meanDays: number;
  byTier: Record<TenureTier, number>;
  newHires90Day: number;
}

export interface EmployeeTenureReport {
  asOf: string;
  rows: EmployeeTenureRow[];
  rollup: EmployeeTenureRollup;
}

export interface EmployeeTenureInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  employees: Employee[];
}

export function buildEmployeeTenure(
  inputs: EmployeeTenureInputs,
): EmployeeTenureReport {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  const active = inputs.employees.filter((e) => e.status === 'ACTIVE');

  const rows: EmployeeTenureRow[] = [];
  let sumDays = 0;
  const byTier: Record<TenureTier, number> = {
    NEW_HIRE: 0,
    UNDER_1_YR: 0,
    UNDER_3_YR: 0,
    UNDER_5_YR: 0,
    OVER_5_YR: 0,
  };

  for (const e of active) {
    const startDate = (e.createdAt ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) continue;
    const days = Math.max(0, daysBetween(startDate, asOf));
    const years = Math.round((days / 365) * 100) / 100;
    let tier: TenureTier;
    if (days < 90) tier = 'NEW_HIRE';
    else if (days < 365) tier = 'UNDER_1_YR';
    else if (days < 365 * 3) tier = 'UNDER_3_YR';
    else if (days < 365 * 5) tier = 'UNDER_5_YR';
    else tier = 'OVER_5_YR';
    rows.push({
      employeeId: e.id,
      employeeName: fullName(e),
      role: e.role,
      daysWithYGE: days,
      yearsWithYGE: years,
      tier,
    });
    sumDays += days;
    byTier[tier] += 1;
  }

  // Newest hires first (lowest days).
  rows.sort((a, b) => a.daysWithYGE - b.daysWithYGE);

  return {
    asOf,
    rows,
    rollup: {
      total: rows.length,
      meanDays: rows.length === 0 ? 0 : Math.round(sumDays / rows.length),
      byTier,
      newHires90Day: byTier.NEW_HIRE,
    },
  };
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
