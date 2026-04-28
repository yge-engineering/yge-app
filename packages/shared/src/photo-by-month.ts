// Per-month photo activity volume.
//
// Plain English: bucket photo log entries by yyyy-mm of takenOn
// to show evidence-collection volume over time. Useful for the
// safety-and-quality monthly review — were we documenting a
// month with a lot of CHANGE_ORDER + DELAY shots, or running
// thin?
//
// Per row: month (yyyy-mm), total, byCategory mix
// (PROGRESS / PRE_CONSTRUCTION / DELAY / CHANGE_ORDER / SWPPP /
// INCIDENT / PUNCH / COMPLETION / OTHER), distinctJobs,
// distinctPhotographers, missingGps.
//
// Sort by month asc.
//
// Different from daily-photo-activity (per day),
// photo-evidence (per-photo cross-reference index),
// photo-by-photographer (per photographer), and
// job-photo-coverage (per job).
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface PhotoByMonthRow {
  month: string;
  total: number;
  byCategory: Partial<Record<PhotoCategory, number>>;
  distinctJobs: number;
  distinctPhotographers: number;
  missingGps: number;
}

export interface PhotoByMonthRollup {
  monthsConsidered: number;
  total: number;
  monthOverMonthCountChange: number;
}

export interface PhotoByMonthInputs {
  photos: Photo[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPhotoByMonth(
  inputs: PhotoByMonthInputs,
): {
  rollup: PhotoByMonthRollup;
  rows: PhotoByMonthRow[];
} {
  type Bucket = {
    month: string;
    total: number;
    byCategory: Map<PhotoCategory, number>;
    jobs: Set<string>;
    photographers: Set<string>;
    missingGps: number;
  };
  const fresh = (month: string): Bucket => ({
    month,
    total: 0,
    byCategory: new Map<PhotoCategory, number>(),
    jobs: new Set<string>(),
    photographers: new Set<string>(),
    missingGps: 0,
  });
  const buckets = new Map<string, Bucket>();

  for (const p of inputs.photos) {
    const month = p.takenOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.total += 1;
    b.byCategory.set(p.category, (b.byCategory.get(p.category) ?? 0) + 1);
    b.jobs.add(p.jobId);
    if (p.photographerName && p.photographerName.trim()) {
      b.photographers.add(p.photographerName.trim().toLowerCase());
    }
    if (p.latitude == null || p.longitude == null) b.missingGps += 1;
    buckets.set(month, b);
  }

  const rows: PhotoByMonthRow[] = Array.from(buckets.values())
    .map((b) => {
      const obj: Partial<Record<PhotoCategory, number>> = {};
      for (const [k, v] of b.byCategory.entries()) obj[k] = v;
      return {
        month: b.month,
        total: b.total,
        byCategory: obj,
        distinctJobs: b.jobs.size,
        distinctPhotographers: b.photographers.size,
        missingGps: b.missingGps,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.total - prev.total;
  }

  let total = 0;
  for (const r of rows) total += r.total;

  return {
    rollup: {
      monthsConsidered: rows.length,
      total,
      monthOverMonthCountChange: mom,
    },
    rows,
  };
}
