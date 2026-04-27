// Daily-report timeliness tracker.
//
// Plain English: a daily report filed three days after the work was
// done is half as useful as one filed the same evening — memory has
// faded, T&M billing has waited, weather claim evidence has cooled.
// This walks submitted daily reports across a date range and
// computes per-foreman filing-lag stats.
//
// Pure derivation. Uses the createdAt timestamp on the report as
// the submission proxy (Phase 1 doesn't have a separate
// submittedAt field on DailyReport).

import type { DailyReport } from './daily-report';

export type DrTimelinessFlag =
  | 'SAME_DAY'  // filed within 24 hours
  | 'NEXT_DAY'  // filed within 48 hours
  | 'LATE'      // 2-7 days
  | 'STALE';    // 8+ days

export interface DrTimelinessRow {
  foremanId: string;
  reportCount: number;
  /** Mean days from work-date to filed (createdAt). */
  meanLagDays: number;
  /** Worst lag in the period. */
  maxLagDays: number;
  sameDay: number;
  nextDay: number;
  late: number;
  stale: number;
  /** sameDay / reportCount. */
  sameDayRate: number;
}

export interface DrTimelinessReport {
  start: string;
  end: string;
  reportCount: number;
  blendedMeanLagDays: number;
  blendedSameDayRate: number;
  byForeman: DrTimelinessRow[];
}

export interface DrTimelinessInputs {
  start: string;
  end: string;
  dailyReports: DailyReport[];
}

export function buildDrTimelinessReport(
  inputs: DrTimelinessInputs,
): DrTimelinessReport {
  const { start, end, dailyReports } = inputs;

  const inWindow = dailyReports.filter(
    (d) => d.submitted && d.date >= start && d.date <= end,
  );

  type Bucket = {
    foremanId: string;
    count: number;
    sumLag: number;
    maxLag: number;
    sameDay: number;
    nextDay: number;
    late: number;
    stale: number;
  };
  const byForeman = new Map<string, Bucket>();

  let totalLag = 0;
  let totalSameDay = 0;

  for (const dr of inWindow) {
    const filedDate = (dr.createdAt ?? '').slice(0, 10);
    if (!filedDate) continue;
    const lag = Math.max(0, daysBetween(dr.date, filedDate));
    const flag = classify(lag);

    const b =
      byForeman.get(dr.foremanId) ??
      ({
        foremanId: dr.foremanId,
        count: 0,
        sumLag: 0,
        maxLag: 0,
        sameDay: 0,
        nextDay: 0,
        late: 0,
        stale: 0,
      } as Bucket);
    b.count += 1;
    b.sumLag += lag;
    if (lag > b.maxLag) b.maxLag = lag;
    if (flag === 'SAME_DAY') {
      b.sameDay += 1;
      totalSameDay += 1;
    } else if (flag === 'NEXT_DAY') b.nextDay += 1;
    else if (flag === 'LATE') b.late += 1;
    else b.stale += 1;
    byForeman.set(dr.foremanId, b);
    totalLag += lag;
  }

  const rows: DrTimelinessRow[] = [];
  for (const [, b] of byForeman) {
    rows.push({
      foremanId: b.foremanId,
      reportCount: b.count,
      meanLagDays: b.count === 0 ? 0 : Math.round(b.sumLag / b.count),
      maxLagDays: b.maxLag,
      sameDay: b.sameDay,
      nextDay: b.nextDay,
      late: b.late,
      stale: b.stale,
      sameDayRate: b.count === 0 ? 0 : b.sameDay / b.count,
    });
  }

  // Slowest foreman first by meanLag.
  rows.sort((a, b) => b.meanLagDays - a.meanLagDays);

  return {
    start,
    end,
    reportCount: inWindow.length,
    blendedMeanLagDays:
      inWindow.length === 0 ? 0 : Math.round(totalLag / inWindow.length),
    blendedSameDayRate:
      inWindow.length === 0 ? 0 : totalSameDay / inWindow.length,
    byForeman: rows,
  };
}

function classify(lagDays: number): DrTimelinessFlag {
  if (lagDays <= 1) return 'SAME_DAY';
  if (lagDays <= 2) return 'NEXT_DAY';
  if (lagDays <= 7) return 'LATE';
  return 'STALE';
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
