// Portfolio photo evidence by month with category mix.
//
// Plain English: per yyyy-mm of takenOn, count photos with
// PhotoCategory breakdown (PROGRESS / DELAY / CHANGE_ORDER /
// SWPPP / INCIDENT / etc.), distinct jobs + photographers.
// Drives the "are we capturing enough field evidence" trend.
//
// Per row: month, total, byCategory, distinctJobs,
// distinctPhotographers.
//
// Sort: month asc.
//
// Different from photo-by-month (timing, no category split),
// daily-photo-activity (per day), customer-photo-monthly
// (per customer).
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface PortfolioPhotoMonthlyRow {
  month: string;
  total: number;
  byCategory: Partial<Record<PhotoCategory, number>>;
  distinctJobs: number;
  distinctPhotographers: number;
}

export interface PortfolioPhotoMonthlyRollup {
  monthsConsidered: number;
  totalPhotos: number;
}

export interface PortfolioPhotoMonthlyInputs {
  photos: Photo[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioPhotoMonthly(
  inputs: PortfolioPhotoMonthlyInputs,
): {
  rollup: PortfolioPhotoMonthlyRollup;
  rows: PortfolioPhotoMonthlyRow[];
} {
  type Acc = {
    month: string;
    total: number;
    byCategory: Map<PhotoCategory, number>;
    jobs: Set<string>;
    photographers: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalPhotos = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const p of inputs.photos) {
    const month = p.takenOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        total: 0,
        byCategory: new Map(),
        jobs: new Set(),
        photographers: new Set(),
      };
      accs.set(month, a);
    }
    a.total += 1;
    const cat: PhotoCategory = p.category ?? 'OTHER';
    a.byCategory.set(cat, (a.byCategory.get(cat) ?? 0) + 1);
    a.jobs.add(p.jobId);
    if (p.photographerName) a.photographers.add(p.photographerName);
    totalPhotos += 1;
  }

  const rows: PortfolioPhotoMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byCategory: Partial<Record<PhotoCategory, number>> = {};
      for (const [k, v] of a.byCategory) byCategory[k] = v;
      return {
        month: a.month,
        total: a.total,
        byCategory,
        distinctJobs: a.jobs.size,
        distinctPhotographers: a.photographers.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalPhotos,
    },
    rows,
  };
}
