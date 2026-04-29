// Photo category by month (long format).
//
// Plain English: bucket photos by (yyyy-mm of takenOn,
// PhotoCategory). Useful for the trend view — does the
// CHANGE_ORDER + DELAY share spike during specific seasons?
//
// Per row: month, category, count, distinctJobs.
//
// Sort: month asc, category asc.
//
// Different from photo-by-month (per-month with category mix
// embedded), photo-by-job (per-job), photo-by-photographer (per
// photographer).
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface PhotoCategoryByMonthRow {
  month: string;
  category: PhotoCategory;
  count: number;
  distinctJobs: number;
}

export interface PhotoCategoryByMonthRollup {
  monthsConsidered: number;
  total: number;
}

export interface PhotoCategoryByMonthInputs {
  photos: Photo[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPhotoCategoryByMonth(
  inputs: PhotoCategoryByMonthInputs,
): {
  rollup: PhotoCategoryByMonthRollup;
  rows: PhotoCategoryByMonthRow[];
} {
  type Acc = {
    month: string;
    category: PhotoCategory;
    count: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const monthSet = new Set<string>();
  let total = 0;

  for (const p of inputs.photos) {
    const month = p.takenOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${month}|${p.category}`;
    const acc = accs.get(key) ?? {
      month,
      category: p.category,
      count: 0,
      jobs: new Set<string>(),
    };
    acc.count += 1;
    acc.jobs.add(p.jobId);
    accs.set(key, acc);
    monthSet.add(month);
    total += 1;
  }

  const rows: PhotoCategoryByMonthRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      month: acc.month,
      category: acc.category,
      count: acc.count,
      distinctJobs: acc.jobs.size,
    });
  }

  rows.sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    return a.category.localeCompare(b.category);
  });

  return {
    rollup: {
      monthsConsidered: monthSet.size,
      total,
    },
    rows,
  };
}
