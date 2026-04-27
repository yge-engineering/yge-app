// Weekly daily-report digest.
//
// Plain English: Brook + Ryan want one-line-per-week status: how
// many reports, how many crew hours, how many photos, how many
// distinct jobs touched. Drives weekly ops meetings.
//
// Pure derivation. Buckets by ISO-week (Monday-of-week as key) so
// the output is consistent regardless of where the date range
// boundaries fall.

import type { DailyReport, DailyReportCrewRow } from './daily-report';

export interface DrWeeklyRow {
  /** Monday of the ISO week (yyyy-mm-dd). */
  weekStarting: string;
  reportCount: number;
  totalCrewHours: number;
  totalPhotos: number;
  distinctJobs: number;
  reportsWithIssues: number;
}

export interface DrWeeklySummaryReport {
  start: string;
  end: string;
  weeks: DrWeeklyRow[];
}

export interface DrWeeklySummaryInputs {
  start: string;
  end: string;
  dailyReports: DailyReport[];
}

export function buildDrWeeklySummary(
  inputs: DrWeeklySummaryInputs,
): DrWeeklySummaryReport {
  const { start, end, dailyReports } = inputs;

  const inWindow = dailyReports.filter(
    (d) => d.submitted && d.date >= start && d.date <= end,
  );

  type Bucket = {
    weekStarting: string;
    reportCount: number;
    crewMinutes: number;
    photoCount: number;
    jobs: Set<string>;
    withIssues: number;
  };
  const byWeek = new Map<string, Bucket>();

  for (const dr of inWindow) {
    const wk = mondayOfIsoWeek(dr.date);
    const b =
      byWeek.get(wk) ??
      ({
        weekStarting: wk,
        reportCount: 0,
        crewMinutes: 0,
        photoCount: 0,
        jobs: new Set<string>(),
        withIssues: 0,
      } as Bucket);
    b.reportCount += 1;
    b.photoCount += dr.photoCount ?? 0;
    b.jobs.add(dr.jobId);
    if (dr.issues && dr.issues.trim().length > 0) b.withIssues += 1;
    for (const row of dr.crewOnSite ?? []) {
      b.crewMinutes += rowWorkedMinutes(row);
    }
    byWeek.set(wk, b);
  }

  const weeks: DrWeeklyRow[] = Array.from(byWeek.values())
    .sort((a, b) => a.weekStarting.localeCompare(b.weekStarting))
    .map((b) => ({
      weekStarting: b.weekStarting,
      reportCount: b.reportCount,
      totalCrewHours: round2(b.crewMinutes / 60),
      totalPhotos: b.photoCount,
      distinctJobs: b.jobs.size,
      reportsWithIssues: b.withIssues,
    }));

  return { start, end, weeks };
}

function mondayOfIsoWeek(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return yyyymmdd;
  const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (dow + 6) % 7; // 0 if Mon, 6 if Sun
  const monday = new Date(d.getTime() - diff * 24 * 60 * 60 * 1000);
  return monday.toISOString().slice(0, 10);
}

function rowWorkedMinutes(row: DailyReportCrewRow): number {
  const s = parseHHMM(row.startTime);
  const e = parseHHMM(row.endTime);
  if (s == null || e == null) return 0;
  let total = e - s;
  if (total < 0) total += 24 * 60;
  const lo = parseHHMM(row.lunchOut);
  const li = parseHHMM(row.lunchIn);
  if (lo != null && li != null && li > lo) total -= li - lo;
  const m2o = parseHHMM(row.secondMealOut);
  const m2i = parseHHMM(row.secondMealIn);
  if (m2o != null && m2i != null && m2i > m2o) total -= m2i - m2o;
  return Math.max(0, total);
}

function parseHHMM(s: string | undefined): number | null {
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
