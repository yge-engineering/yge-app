// Per-employee overtime by month.
//
// Plain English: per (employeeId, yyyy-mm of weekStarting), sum
// daily OT (>8h/day) and weekly OT (>40h/week net of daily) from
// every time card. Long-format result. Useful for "who's burning
// the most OT hours this month" + the per-employee monthly OT
// trend.
//
// Per row: employeeId, month, totalHours, regularHours,
// dailyOvertimeHours, weeklyOvertimeHours, overtimeHoursTotal,
// cardsCounted.
//
// Sort: employeeId asc, month asc.
//
// Different from overtime-monthly (portfolio per month, all
// employees), overtime-by-classification (per DIR class),
// timecard-monthly-hours (per month).
//
// Pure derivation. No persisted records.

import type { TimeCard } from './time-card';
import { hoursByDate, totalCardHours } from './time-card';

export interface EmployeeOvertimeMonthlyRow {
  employeeId: string;
  month: string;
  totalHours: number;
  regularHours: number;
  dailyOvertimeHours: number;
  weeklyOvertimeHours: number;
  overtimeHoursTotal: number;
  cardsCounted: number;
}

export interface EmployeeOvertimeMonthlyRollup {
  employeesConsidered: number;
  monthsConsidered: number;
  overtimeHoursTotal: number;
}

export interface EmployeeOvertimeMonthlyInputs {
  timeCards: TimeCard[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildEmployeeOvertimeMonthly(
  inputs: EmployeeOvertimeMonthlyInputs,
): {
  rollup: EmployeeOvertimeMonthlyRollup;
  rows: EmployeeOvertimeMonthlyRow[];
} {
  type Acc = {
    employeeId: string;
    month: string;
    total: number;
    daily: number;
    weekly: number;
    cards: number;
  };
  const accs = new Map<string, Acc>();
  const empSet = new Set<string>();
  const monthSet = new Set<string>();

  for (const card of inputs.timeCards) {
    const month = card.weekStarting.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const total = totalCardHours(card);
    let daily = 0;
    for (const { hours } of hoursByDate(card)) {
      if (hours > 8) daily += hours - 8;
    }
    const weekly = Math.max(0, total - 40 - daily);
    const key = `${card.employeeId}|${month}`;
    const acc = accs.get(key) ?? {
      employeeId: card.employeeId,
      month,
      total: 0,
      daily: 0,
      weekly: 0,
      cards: 0,
    };
    acc.total += total;
    acc.daily += daily;
    acc.weekly += weekly;
    acc.cards += 1;
    accs.set(key, acc);
    empSet.add(card.employeeId);
    monthSet.add(month);
  }

  const rows: EmployeeOvertimeMonthlyRow[] = [];
  let portfolioOt = 0;

  for (const acc of accs.values()) {
    const total = Math.round(acc.total * 100) / 100;
    const ot = Math.round((acc.daily + acc.weekly) * 100) / 100;
    const reg = Math.max(0, Math.round((total - ot) * 100) / 100);
    rows.push({
      employeeId: acc.employeeId,
      month: acc.month,
      totalHours: total,
      regularHours: reg,
      dailyOvertimeHours: Math.round(acc.daily * 100) / 100,
      weeklyOvertimeHours: Math.round(acc.weekly * 100) / 100,
      overtimeHoursTotal: ot,
      cardsCounted: acc.cards,
    });
    portfolioOt += ot;
  }

  rows.sort((a, b) => {
    if (a.employeeId !== b.employeeId) return a.employeeId.localeCompare(b.employeeId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      employeesConsidered: empSet.size,
      monthsConsidered: monthSet.size,
      overtimeHoursTotal: Math.round(portfolioOt * 100) / 100,
    },
    rows,
  };
}
