// Per (job, photo category) photo count.
//
// Plain English: bucket photos by (jobId, PhotoCategory) — the
// "show me how this job's photo evidence breaks down by kind"
// view. Useful for "lots of CHANGE_ORDER photos here, evidence
// stack is solid" pre-claim packet review.
//
// Per row: jobId, category, count, distinctDays.
//
// Sort: jobId asc, count desc within job.
//
// Different from photo-by-job (per-job rollup with category mix
// nested), photo-by-month (per-month, no job axis), photo-evidence-
// by-job-monthly (claim categories only, monthly axis).
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface JobPhotoByCategoryRow {
  jobId: string;
  category: PhotoCategory;
  count: number;
  distinctDays: number;
}

export interface JobPhotoByCategoryRollup {
  jobsConsidered: number;
  categoriesConsidered: number;
  total: number;
}

export interface JobPhotoByCategoryInputs {
  photos: Photo[];
  /** Optional yyyy-mm-dd window applied to takenOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobPhotoByCategory(
  inputs: JobPhotoByCategoryInputs,
): {
  rollup: JobPhotoByCategoryRollup;
  rows: JobPhotoByCategoryRow[];
} {
  type Acc = {
    jobId: string;
    category: PhotoCategory;
    count: number;
    days: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const catSet = new Set<PhotoCategory>();
  let total = 0;

  for (const p of inputs.photos) {
    if (inputs.fromDate && p.takenOn < inputs.fromDate) continue;
    if (inputs.toDate && p.takenOn > inputs.toDate) continue;
    const key = `${p.jobId}|${p.category}`;
    const acc = accs.get(key) ?? {
      jobId: p.jobId,
      category: p.category,
      count: 0,
      days: new Set<string>(),
    };
    acc.count += 1;
    acc.days.add(p.takenOn);
    accs.set(key, acc);
    jobSet.add(p.jobId);
    catSet.add(p.category);
    total += 1;
  }

  const rows: JobPhotoByCategoryRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      category: acc.category,
      count: acc.count,
      distinctDays: acc.days.size,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return b.count - a.count;
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      categoriesConsidered: catSet.size,
      total,
    },
    rows,
  };
}
