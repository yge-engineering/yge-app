// Employee-anchored photo year-over-year.
//
// Plain English: for one employee (matched by photographerName),
// collapse two years of photos into a comparison: counts,
// category mix, distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface EmployeePhotoYoyResult {
  employeeName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByCategory: Partial<Record<PhotoCategory, number>>;
  priorDistinctJobs: number;
  currentTotal: number;
  currentByCategory: Partial<Record<PhotoCategory, number>>;
  currentDistinctJobs: number;
  totalDelta: number;
}

export interface EmployeePhotoYoyInputs {
  employeeName: string;
  photos: Photo[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEmployeePhotoYoy(
  inputs: EmployeePhotoYoyInputs,
): EmployeePhotoYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.employeeName);

  type Bucket = {
    total: number;
    byCategory: Map<PhotoCategory, number>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, byCategory: new Map(), jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.photos) {
    if (norm(p.photographerName) !== target) continue;
    const year = Number(p.takenOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const cat: PhotoCategory = p.category ?? 'OTHER';
    b.byCategory.set(cat, (b.byCategory.get(cat) ?? 0) + 1);
    b.jobs.add(p.jobId);
  }

  function catRecord(m: Map<PhotoCategory, number>): Partial<Record<PhotoCategory, number>> {
    const out: Partial<Record<PhotoCategory, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    employeeName: inputs.employeeName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByCategory: catRecord(prior.byCategory),
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentByCategory: catRecord(current.byCategory),
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
  };
}
