// Per-job photo activity by month.
//
// Plain English: bucket photos by (jobId, yyyy-mm of takenOn).
// Long-format view of when each job's evidence was collected.
// Useful for the "show me Sulphur Springs photo cadence" trace
// or the year-end claim packet pre-flight.
//
// Per row: jobId, month, total, distinctDays, distinctPhotographers,
// missingGps.
//
// Sort: jobId asc, month asc.
//
// Different from photo-by-job (per-job rollup, no month axis),
// photo-by-month (per-month, no job axis), and
// daily-photo-activity (per-day).
//
// Pure derivation. No persisted records.

import type { Photo } from './photo';

export interface JobPhotoMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  distinctDays: number;
  distinctPhotographers: number;
  missingGps: number;
}

export interface JobPhotoMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  total: number;
}

export interface JobPhotoMonthlyInputs {
  photos: Photo[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobPhotoMonthly(
  inputs: JobPhotoMonthlyInputs,
): {
  rollup: JobPhotoMonthlyRollup;
  rows: JobPhotoMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    days: Set<string>;
    photographers: Set<string>;
    missingGps: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let total = 0;

  for (const p of inputs.photos) {
    const month = p.takenOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${p.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: p.jobId,
      month,
      total: 0,
      days: new Set<string>(),
      photographers: new Set<string>(),
      missingGps: 0,
    };
    acc.total += 1;
    acc.days.add(p.takenOn);
    if (p.photographerName && p.photographerName.trim()) {
      acc.photographers.add(p.photographerName.trim().toLowerCase());
    }
    if (p.latitude == null || p.longitude == null) acc.missingGps += 1;
    accs.set(key, acc);
    jobSet.add(p.jobId);
    monthSet.add(month);
    total += 1;
  }

  const rows: JobPhotoMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      total: acc.total,
      distinctDays: acc.days.size,
      distinctPhotographers: acc.photographers.size,
      missingGps: acc.missingGps,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      monthsConsidered: monthSet.size,
      total,
    },
    rows,
  };
}
