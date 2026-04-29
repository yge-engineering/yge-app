// Portfolio photo evidence year-over-year.
//
// Plain English: collapse two years of photo logs into a
// comparison row. Counts, category mix, distinct jobs +
// photographers, plus deltas. Sized for the year-end
// "are we capturing enough field evidence" review.
//
// Different from portfolio-photo-monthly (per month),
// daily-photo-activity (per day).
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface PortfolioPhotoYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByCategory: Partial<Record<PhotoCategory, number>>;
  priorDistinctJobs: number;
  priorDistinctPhotographers: number;
  currentTotal: number;
  currentByCategory: Partial<Record<PhotoCategory, number>>;
  currentDistinctJobs: number;
  currentDistinctPhotographers: number;
  totalDelta: number;
}

export interface PortfolioPhotoYoyInputs {
  photos: Photo[];
  currentYear: number;
}

export function buildPortfolioPhotoYoy(
  inputs: PortfolioPhotoYoyInputs,
): PortfolioPhotoYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    byCategory: Map<PhotoCategory, number>;
    jobs: Set<string>;
    photographers: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      byCategory: new Map(),
      jobs: new Set(),
      photographers: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.photos) {
    const year = Number(p.takenOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const cat: PhotoCategory = p.category ?? 'OTHER';
    b.byCategory.set(cat, (b.byCategory.get(cat) ?? 0) + 1);
    b.jobs.add(p.jobId);
    if (p.photographerName) b.photographers.add(p.photographerName);
  }

  function toRecord(m: Map<PhotoCategory, number>): Partial<Record<PhotoCategory, number>> {
    const out: Partial<Record<PhotoCategory, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByCategory: toRecord(prior.byCategory),
    priorDistinctJobs: prior.jobs.size,
    priorDistinctPhotographers: prior.photographers.size,
    currentTotal: current.total,
    currentByCategory: toRecord(current.byCategory),
    currentDistinctJobs: current.jobs.size,
    currentDistinctPhotographers: current.photographers.size,
    totalDelta: current.total - prior.total,
  };
}
