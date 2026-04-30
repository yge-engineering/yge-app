// Customer-anchored photo year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of photo logs into a comparison: counts,
// category mix, distinct jobs + photographers, plus deltas.
// Drives the per-customer year-end "are we capturing enough
// field evidence" review.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Photo, PhotoCategory } from './photo';

export interface CustomerPhotoYoyResult {
  customerName: string;
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

export interface CustomerPhotoYoyInputs {
  customerName: string;
  photos: Photo[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerPhotoYoy(
  inputs: CustomerPhotoYoyInputs,
): CustomerPhotoYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

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
    if (!customerJobs.has(p.jobId)) continue;
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
    customerName: inputs.customerName,
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
