// Job-anchored photo year-over-year.
//
// Plain English: for one job, collapse two years of photos
// into a comparison: counts, category mix, distinct
// photographers, plus deltas.
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface JobPhotoYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByCategory: Partial<Record<PhotoCategory, number>>;
  priorDistinctPhotographers: number;
  currentTotal: number;
  currentByCategory: Partial<Record<PhotoCategory, number>>;
  currentDistinctPhotographers: number;
  totalDelta: number;
}

export interface JobPhotoYoyInputs {
  jobId: string;
  photos: Photo[];
  currentYear: number;
}

export function buildJobPhotoYoy(
  inputs: JobPhotoYoyInputs,
): JobPhotoYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    byCategory: Map<PhotoCategory, number>;
    photographers: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, byCategory: new Map(), photographers: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.photos) {
    if (p.jobId !== inputs.jobId) continue;
    const year = Number(p.takenOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const cat: PhotoCategory = p.category ?? 'OTHER';
    b.byCategory.set(cat, (b.byCategory.get(cat) ?? 0) + 1);
    if (p.photographerName) b.photographers.add(p.photographerName);
  }

  function catRecord(m: Map<PhotoCategory, number>): Partial<Record<PhotoCategory, number>> {
    const out: Partial<Record<PhotoCategory, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByCategory: catRecord(prior.byCategory),
    priorDistinctPhotographers: prior.photographers.size,
    currentTotal: current.total,
    currentByCategory: catRecord(current.byCategory),
    currentDistinctPhotographers: current.photographers.size,
    totalDelta: current.total - prior.total,
  };
}
