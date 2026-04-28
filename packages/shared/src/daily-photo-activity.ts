// Per-day portfolio photo activity.
//
// Plain English: for each yyyy-mm-dd in the window, how many
// photos were captured across all jobs and what category mix?
// Useful for spotting documentation deserts (no photos for a
// week on an active job) and capturing the rhythm of evidence
// collection.
//
// Per row: date, totalPhotos, distinctJobs, distinctPhotographers,
// counts per category.
//
// Different from job-photo-coverage (per-job DR-coverage rate),
// dr-photo-coverage (per-DR average), photo-evidence
// (per-photo evidence index), and job-photo-category-mix
// (per-job category mix). This is the time-series view across
// the portfolio.
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface DailyPhotoActivityRow {
  date: string;
  totalPhotos: number;
  distinctJobs: number;
  distinctPhotographers: number;
  countsByCategory: Partial<Record<PhotoCategory, number>>;
}

export interface DailyPhotoActivityRollup {
  daysConsidered: number;
  totalPhotos: number;
  /** Highest single-day photo count. */
  peakDate: string | null;
  peakCount: number;
}

export interface DailyPhotoActivityInputs {
  photos: Photo[];
  /** Inclusive yyyy-mm-dd window applied to takenOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildDailyPhotoActivity(
  inputs: DailyPhotoActivityInputs,
): {
  rollup: DailyPhotoActivityRollup;
  rows: DailyPhotoActivityRow[];
} {
  type Bucket = {
    date: string;
    photos: Photo[];
    jobs: Set<string>;
    photographers: Set<string>;
    counts: Map<PhotoCategory, number>;
  };
  const buckets = new Map<string, Bucket>();

  for (const p of inputs.photos) {
    if (inputs.fromDate && p.takenOn < inputs.fromDate) continue;
    if (inputs.toDate && p.takenOn > inputs.toDate) continue;
    const b = buckets.get(p.takenOn) ?? {
      date: p.takenOn,
      photos: [],
      jobs: new Set<string>(),
      photographers: new Set<string>(),
      counts: new Map<PhotoCategory, number>(),
    };
    b.photos.push(p);
    b.jobs.add(p.jobId);
    if (p.photographerName) b.photographers.add(p.photographerName);
    b.counts.set(p.category, (b.counts.get(p.category) ?? 0) + 1);
    buckets.set(p.takenOn, b);
  }

  const rows: DailyPhotoActivityRow[] = Array.from(buckets.values())
    .map((b) => {
      const obj: Partial<Record<PhotoCategory, number>> = {};
      for (const [k, v] of b.counts.entries()) obj[k] = v;
      return {
        date: b.date,
        totalPhotos: b.photos.length,
        distinctJobs: b.jobs.size,
        distinctPhotographers: b.photographers.size,
        countsByCategory: obj,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  let peak: string | null = null;
  let peakCount = 0;
  let totalPhotos = 0;
  for (const r of rows) {
    if (r.totalPhotos > peakCount) {
      peakCount = r.totalPhotos;
      peak = r.date;
    }
    totalPhotos += r.totalPhotos;
  }

  return {
    rollup: {
      daysConsidered: rows.length,
      totalPhotos,
      peakDate: peak,
      peakCount,
    },
    rows,
  };
}
