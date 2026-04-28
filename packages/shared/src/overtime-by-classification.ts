// Per-classification overtime exposure.
//
// Plain English: which DIR classifications are eating the most
// overtime? CA daily OT (>8h/day = 1.5x) hits operators and
// laborers harder than salaried supervisors. If laborers are
// burning weekly OT week after week, that's a signal we're a
// crew member short, not that everyone wants extra hours.
//
// Per row: hours rolled up over every time card on file,
// grouped by the employee's classification at the time. We
// trust the classification on the Employee record (Phase 2 will
// snapshot per-card classification when classifications drift
// mid-job).
//
// Different from overtime-monthly (by month, all classifications
// combined), overtime-exposure (current-week alarm), and
// employee-classification-mix (distinct classifications per
// employee).
//
// Pure derivation. No persisted records.

import type { DirClassification, Employee } from './employee';
import { classificationLabel } from './employee';
import type { TimeCard } from './time-card';
import { hoursByDate, totalCardHours } from './time-card';

export interface OvertimeByClassificationRow {
  classification: DirClassification;
  label: string;
  employeesConsidered: number;
  cardsConsidered: number;
  totalHours: number;
  regularHours: number;
  dailyOvertimeHours: number;
  weeklyOvertimeHours: number;
  overtimeHoursTotal: number;
  /** OT / total, rounded to 4 decimals. */
  overtimeShare: number;
}

export interface OvertimeByClassificationRollup {
  classificationsConsidered: number;
  totalHours: number;
  overtimeHoursTotal: number;
  portfolioOvertimeShare: number;
}

export interface OvertimeByClassificationInputs {
  employees: Employee[];
  timeCards: TimeCard[];
  /** Optional yyyy-mm-dd window applied to weekStarting. */
  fromWeek?: string;
  toWeek?: string;
}

export function buildOvertimeByClassification(
  inputs: OvertimeByClassificationInputs,
): {
  rollup: OvertimeByClassificationRollup;
  rows: OvertimeByClassificationRow[];
} {
  const empClass = new Map<string, DirClassification>();
  for (const e of inputs.employees) empClass.set(e.id, e.classification);

  type Acc = {
    classification: DirClassification;
    employees: Set<string>;
    cards: number;
    total: number;
    daily: number;
    weekly: number;
  };
  const accs = new Map<DirClassification, Acc>();

  for (const card of inputs.timeCards) {
    if (inputs.fromWeek && card.weekStarting < inputs.fromWeek) continue;
    if (inputs.toWeek && card.weekStarting > inputs.toWeek) continue;
    const cls = empClass.get(card.employeeId) ?? 'NOT_APPLICABLE';
    const total = totalCardHours(card);
    let daily = 0;
    for (const { hours } of hoursByDate(card)) {
      if (hours > 8) daily += hours - 8;
    }
    const weekly = Math.max(0, total - 40 - daily);
    const acc = accs.get(cls) ?? {
      classification: cls,
      employees: new Set<string>(),
      cards: 0,
      total: 0,
      daily: 0,
      weekly: 0,
    };
    acc.employees.add(card.employeeId);
    acc.cards += 1;
    acc.total += total;
    acc.daily += daily;
    acc.weekly += weekly;
    accs.set(cls, acc);
  }

  const rows: OvertimeByClassificationRow[] = [];
  let portfolioTotal = 0;
  let portfolioOT = 0;

  for (const acc of accs.values()) {
    const ot = Math.round((acc.daily + acc.weekly) * 100) / 100;
    const total = Math.round(acc.total * 100) / 100;
    const reg = Math.max(0, Math.round((total - ot) * 100) / 100);
    const share = total === 0 ? 0 : Math.round((ot / total) * 10_000) / 10_000;
    rows.push({
      classification: acc.classification,
      label: classificationLabel(acc.classification),
      employeesConsidered: acc.employees.size,
      cardsConsidered: acc.cards,
      totalHours: total,
      regularHours: reg,
      dailyOvertimeHours: Math.round(acc.daily * 100) / 100,
      weeklyOvertimeHours: Math.round(acc.weekly * 100) / 100,
      overtimeHoursTotal: ot,
      overtimeShare: share,
    });
    portfolioTotal += total;
    portfolioOT += ot;
  }

  rows.sort((a, b) => b.overtimeHoursTotal - a.overtimeHoursTotal);

  const totalRounded = Math.round(portfolioTotal * 100) / 100;
  const otRounded = Math.round(portfolioOT * 100) / 100;
  const share = totalRounded === 0
    ? 0
    : Math.round((otRounded / totalRounded) * 10_000) / 10_000;

  return {
    rollup: {
      classificationsConsidered: rows.length,
      totalHours: totalRounded,
      overtimeHoursTotal: otRounded,
      portfolioOvertimeShare: share,
    },
    rows,
  };
}
