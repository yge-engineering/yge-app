// Meal-break violation summary across a date range.
//
// Plain English: every daily report carries crew rows with start/end/
// lunch times. The daily-report module already detects per-row
// violations under CA Labor Code §512:
//   - shift > 5 hrs requires a first 30-min meal break
//   - shift > 10 hrs requires a second 30-min meal break
//
// Per-row violations are flagged at submission time. This module
// rolls those up across a date range so management sees:
//   1. Total violations + waived count for the period
//   2. Per-employee tally — which crew member keeps missing meals
//   3. Per-job tally — which jobs are running hot
//   4. Split by kind (first-meal vs second-meal)
//
// PAGA exposure: each missed meal break under §512 is a $50/hour
// premium owed to the employee. A pattern of missed seconds on a
// long-shift job can run into real money. This is the visibility
// layer for that risk.
//
// Pure derivation. No persisted records.

import type { DailyReport, DailyReportCrewRow, MealBreakViolation } from './daily-report';
import { crewRowViolations } from './daily-report';

export interface MealBreakViolationRow {
  reportId: string;
  reportDate: string;
  jobId: string;
  employeeId: string;
  workedHours: number;
  /** Always >= 1 — could be both first AND second meal missing. */
  violations: MealBreakViolation[];
  /** When set, the foreman waived the violations. Counts as
   *  acknowledged-but-still-a-violation in the summary. */
  waiverNote: string | undefined;
}

export interface MealBreakEmployeeRollup {
  employeeId: string;
  totalViolations: number;
  waivedViolations: number;
  unwaivedViolations: number;
  reportsAffected: number;
}

export interface MealBreakJobRollup {
  jobId: string;
  totalViolations: number;
  waivedViolations: number;
  unwaivedViolations: number;
  reportsAffected: number;
}

export interface MealBreakSummary {
  start: string;
  end: string;
  reportCount: number;
  rowCount: number;

  totalViolations: number;
  /** Of the total, how many are on rows with a foreman waiver note. */
  waivedViolations: number;
  /** totalViolations - waivedViolations. */
  unwaivedViolations: number;

  firstMealCount: number;
  secondMealCount: number;

  byEmployee: MealBreakEmployeeRollup[];
  byJob: MealBreakJobRollup[];
  rows: MealBreakViolationRow[];
}

export interface MealBreakSummaryInputs {
  start: string;
  end: string;
  dailyReports: DailyReport[];
}

export function buildMealBreakSummary(
  inputs: MealBreakSummaryInputs,
): MealBreakSummary {
  const { start, end, dailyReports } = inputs;

  const inWindow = dailyReports.filter(
    (r) => r.submitted && r.date >= start && r.date <= end,
  );

  const rows: MealBreakViolationRow[] = [];
  let totalViolations = 0;
  let waivedViolations = 0;
  let firstMealCount = 0;
  let secondMealCount = 0;
  let rowCount = 0;

  type EBucket = {
    total: number;
    waived: number;
    reports: Set<string>;
  };
  const byEmployeeMap = new Map<string, EBucket>();
  type JBucket = EBucket;
  const byJobMap = new Map<string, JBucket>();

  for (const report of inWindow) {
    rowCount += report.crewOnSite.length;
    for (const row of report.crewOnSite) {
      const violations = crewRowViolations(row);
      if (violations.length === 0) continue;

      const waived = !!row.mealBreakWaiverNote;
      totalViolations += violations.length;
      if (waived) waivedViolations += violations.length;
      for (const v of violations) {
        if (v.kind === 'first-meal-missing') firstMealCount += 1;
        else secondMealCount += 1;
      }

      // Per-employee bucket.
      const eb =
        byEmployeeMap.get(row.employeeId) ??
        ({ total: 0, waived: 0, reports: new Set<string>() } as EBucket);
      eb.total += violations.length;
      if (waived) eb.waived += violations.length;
      eb.reports.add(report.id);
      byEmployeeMap.set(row.employeeId, eb);

      // Per-job bucket.
      const jb =
        byJobMap.get(report.jobId) ??
        ({ total: 0, waived: 0, reports: new Set<string>() } as JBucket);
      jb.total += violations.length;
      if (waived) jb.waived += violations.length;
      jb.reports.add(report.id);
      byJobMap.set(report.jobId, jb);

      rows.push({
        reportId: report.id,
        reportDate: report.date,
        jobId: report.jobId,
        employeeId: row.employeeId,
        workedHours: round2(workedHoursFromRow(row)),
        violations,
        waiverNote: row.mealBreakWaiverNote,
      });
    }
  }

  const byEmployee: MealBreakEmployeeRollup[] = [];
  for (const [employeeId, b] of byEmployeeMap) {
    byEmployee.push({
      employeeId,
      totalViolations: b.total,
      waivedViolations: b.waived,
      unwaivedViolations: b.total - b.waived,
      reportsAffected: b.reports.size,
    });
  }
  byEmployee.sort((a, b) => b.unwaivedViolations - a.unwaivedViolations);

  const byJob: MealBreakJobRollup[] = [];
  for (const [jobId, b] of byJobMap) {
    byJob.push({
      jobId,
      totalViolations: b.total,
      waivedViolations: b.waived,
      unwaivedViolations: b.total - b.waived,
      reportsAffected: b.reports.size,
    });
  }
  byJob.sort((a, b) => b.unwaivedViolations - a.unwaivedViolations);

  // Worst row first: unwaived first, then most violations on the row,
  // then most worked hours.
  rows.sort((a, b) => {
    const aWaived = a.waiverNote ? 1 : 0;
    const bWaived = b.waiverNote ? 1 : 0;
    if (aWaived !== bWaived) return aWaived - bWaived;
    if (a.violations.length !== b.violations.length) {
      return b.violations.length - a.violations.length;
    }
    return b.workedHours - a.workedHours;
  });

  return {
    start,
    end,
    reportCount: inWindow.length,
    rowCount,
    totalViolations,
    waivedViolations,
    unwaivedViolations: totalViolations - waivedViolations,
    firstMealCount,
    secondMealCount,
    byEmployee,
    byJob,
    rows,
  };
}

function workedHoursFromRow(row: DailyReportCrewRow): number {
  // Inline copy of daily-report's worked-minutes logic so this module
  // doesn't depend on a non-exported helper.
  const start = parseHHMM(row.startTime);
  const end = parseHHMM(row.endTime);
  if (start == null || end == null) return 0;
  let total = end - start;
  if (total < 0) total += 24 * 60;
  const lo = parseHHMM(row.lunchOut);
  const li = parseHHMM(row.lunchIn);
  if (lo != null && li != null && li > lo) total -= li - lo;
  const m2o = parseHHMM(row.secondMealOut);
  const m2i = parseHHMM(row.secondMealIn);
  if (m2o != null && m2i != null && m2i > m2o) total -= m2i - m2o;
  return Math.max(0, total) / 60;
}

function parseHHMM(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
