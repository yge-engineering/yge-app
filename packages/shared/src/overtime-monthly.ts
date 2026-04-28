// Per-month overtime portfolio trend.
//
// Plain English: bucket every submitted DR by yyyy-mm and across
// each month roll up:
//   - total worked hours (sum of crewRowWorkedMinutes / 60)
//   - hours over 8 in a single shift, per CA daily-OT rule
//   - hours over 40 in a workweek (per-employee, weekly basis)
//   - OT share of total hours
//
// CA daily OT rule (Wage Order 16, applies to most heavy-civil
// work): hours 9-12 in a shift are 1.5x; hours 12+ are 2x.
// Weekly OT (>40 hr/wk for an employee) is also 1.5x. We compute
// an OVERLAP-aware total — an employee who works 50 hours
// across 5 ten-hour shifts has 10 daily-OT hours (2/day × 5)
// AND 10 weekly-OT hours (50−40), but should not be double-
// counted; we take whichever is larger per employee per week.
//
// Different from overtime-exposure (portfolio snapshot, no
// trend) and crew-utilization (general utilization). This is
// the time-series view of OT as a share of total labor.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import { crewRowWorkedMinutes } from './daily-report';

export interface OvertimeMonthRow {
  month: string;
  totalHours: number;
  /** Daily OT only — hours > 8 each shift across the month. */
  dailyOtHours: number;
  /** Weekly OT — distinct from daily OT (max of the two per
   *  employee per week to avoid double-counting). */
  weeklyOtHours: number;
  /** Combined OT (max-per-employee-per-week strategy). */
  combinedOtHours: number;
  /** combinedOtHours / totalHours. 0 when totalHours is 0. */
  otShare: number;
  drCount: number;
  distinctEmployees: number;
}

export interface OvertimeMonthlyRollup {
  monthsConsidered: number;
  totalHours: number;
  totalOtHours: number;
  /** Latest month vs prior month combined OT change. */
  monthOverMonthChange: number;
}

export interface OvertimeMonthlyInputs {
  reports: DailyReport[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildOvertimeMonthly(inputs: OvertimeMonthlyInputs): {
  rollup: OvertimeMonthlyRollup;
  rows: OvertimeMonthRow[];
} {
  // Per-month per-employee per-week minutes accumulator.
  // weekKey = monday-of-week iso date.
  type EmpWeek = {
    employeeId: string;
    weekStart: string;
    minutes: number;
    /** Daily OT minutes accumulated from > 8h shifts. */
    dailyOtMinutes: number;
  };
  type Bucket = {
    month: string;
    drs: Set<string>;
    employees: Set<string>;
    /** Map<empId|weekStart, EmpWeek>. */
    empWeeks: Map<string, EmpWeek>;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of inputs.reports) {
    if (!r.submitted) continue;
    const month = r.date.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;

    const b = buckets.get(month) ?? {
      month,
      drs: new Set<string>(),
      employees: new Set<string>(),
      empWeeks: new Map<string, EmpWeek>(),
    };
    b.drs.add(r.id);

    const monday = mondayOfIsoWeek(r.date);
    for (const row of r.crewOnSite) {
      const minutes = crewRowWorkedMinutes(row);
      if (minutes <= 0) continue;
      b.employees.add(row.employeeId);
      const key = `${row.employeeId}|${monday}`;
      const ew = b.empWeeks.get(key) ?? {
        employeeId: row.employeeId,
        weekStart: monday,
        minutes: 0,
        dailyOtMinutes: 0,
      };
      ew.minutes += minutes;
      // Daily OT — hours > 8 in this shift.
      if (minutes > 8 * 60) {
        ew.dailyOtMinutes += minutes - 8 * 60;
      }
      b.empWeeks.set(key, ew);
    }
    buckets.set(month, b);
  }

  const rows: OvertimeMonthRow[] = [];
  for (const b of buckets.values()) {
    let totalMinutes = 0;
    let dailyOt = 0;
    let weeklyOt = 0;
    let combined = 0;
    for (const ew of b.empWeeks.values()) {
      totalMinutes += ew.minutes;
      dailyOt += ew.dailyOtMinutes;
      const weekly = Math.max(0, ew.minutes - 40 * 60);
      weeklyOt += weekly;
      // Per-employee per-week: take max of daily / weekly to avoid
      // double-counting overlap.
      combined += Math.max(ew.dailyOtMinutes, weekly);
    }
    const totalH = round2(totalMinutes / 60);
    const dailyH = round2(dailyOt / 60);
    const weeklyH = round2(weeklyOt / 60);
    const combinedH = round2(combined / 60);
    const share = totalH === 0 ? 0 : Math.round((combinedH / totalH) * 10_000) / 10_000;
    rows.push({
      month: b.month,
      totalHours: totalH,
      dailyOtHours: dailyH,
      weeklyOtHours: weeklyH,
      combinedOtHours: combinedH,
      otShare: share,
      drCount: b.drs.size,
      distinctEmployees: b.employees.size,
    });
  }

  rows.sort((a, b) => a.month.localeCompare(b.month));

  // MoM
  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = round2(last.combinedOtHours - prev.combinedOtHours);
  }

  let totalH = 0;
  let totalOt = 0;
  for (const r of rows) {
    totalH += r.totalHours;
    totalOt += r.combinedOtHours;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalHours: round2(totalH),
      totalOtHours: round2(totalOt),
      monthOverMonthChange: mom,
    },
    rows,
  };
}

function mondayOfIsoWeek(iso: string): string {
  const parts = iso.split('-').map((p) => Number.parseInt(p, 10));
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const offset = (dow + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
