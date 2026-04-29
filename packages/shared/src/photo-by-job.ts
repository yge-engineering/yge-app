// Per-job photo evidence summary.
//
// Plain English: roll the photo log up by jobId — total count,
// distinct days shooting, distinct photographers, category mix,
// last photo date, missingGps. Useful for the per-job claim
// evidence binder pre-flight check.
//
// Per row: jobId, total, distinctDays, distinctPhotographers,
// missingGps, lastTakenOn, byCategory.
//
// Sort by total desc.
//
// Different from job-photo-coverage (windowed coverage flag),
// daily-photo-activity (per day), photo-by-photographer (per
// photographer), photo-by-month (per month). This is the per-job
// evidence count.
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface PhotoByJobRow {
  jobId: string;
  total: number;
  distinctDays: number;
  distinctPhotographers: number;
  missingGps: number;
  lastTakenOn: string | null;
  byCategory: Partial<Record<PhotoCategory, number>>;
}

export interface PhotoByJobRollup {
  jobsConsidered: number;
  total: number;
}

export interface PhotoByJobInputs {
  photos: Photo[];
  /** Optional yyyy-mm-dd window applied to takenOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildPhotoByJob(
  inputs: PhotoByJobInputs,
): {
  rollup: PhotoByJobRollup;
  rows: PhotoByJobRow[];
} {
  type Acc = {
    jobId: string;
    total: number;
    days: Set<string>;
    photographers: Set<string>;
    missingGps: number;
    lastTakenOn: string | null;
    byCategory: Map<PhotoCategory, number>;
  };
  const accs = new Map<string, Acc>();
  let total = 0;

  for (const p of inputs.photos) {
    if (inputs.fromDate && p.takenOn < inputs.fromDate) continue;
    if (inputs.toDate && p.takenOn > inputs.toDate) continue;
    total += 1;
    const acc = accs.get(p.jobId) ?? {
      jobId: p.jobId,
      total: 0,
      days: new Set<string>(),
      photographers: new Set<string>(),
      missingGps: 0,
      lastTakenOn: null,
      byCategory: new Map<PhotoCategory, number>(),
    };
    acc.total += 1;
    acc.days.add(p.takenOn);
    if (p.photographerName && p.photographerName.trim()) {
      acc.photographers.add(p.photographerName.trim().toLowerCase());
    }
    if (p.latitude == null || p.longitude == null) acc.missingGps += 1;
    if (!acc.lastTakenOn || p.takenOn > acc.lastTakenOn) acc.lastTakenOn = p.takenOn;
    acc.byCategory.set(p.category, (acc.byCategory.get(p.category) ?? 0) + 1);
    accs.set(p.jobId, acc);
  }

  const rows: PhotoByJobRow[] = [];
  for (const acc of accs.values()) {
    const obj: Partial<Record<PhotoCategory, number>> = {};
    for (const [k, v] of acc.byCategory.entries()) obj[k] = v;
    rows.push({
      jobId: acc.jobId,
      total: acc.total,
      distinctDays: acc.days.size,
      distinctPhotographers: acc.photographers.size,
      missingGps: acc.missingGps,
      lastTakenOn: acc.lastTakenOn,
      byCategory: obj,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  return {
    rollup: {
      jobsConsidered: rows.length,
      total,
    },
    rows,
  };
}
