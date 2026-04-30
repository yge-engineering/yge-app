// Portfolio photo evidence snapshot.
//
// Plain English: as-of today, count photos with category mix
// + distinct jobs/photographers + YTD callout. Drives the
// right-now field-evidence overview.
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface PortfolioPhotoSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  ytdPhotos: number;
  totalPhotos: number;
  byCategory: Partial<Record<PhotoCategory, number>>;
  distinctJobs: number;
  distinctPhotographers: number;
}

export interface PortfolioPhotoSnapshotInputs {
  photos: Photo[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioPhotoSnapshot(
  inputs: PortfolioPhotoSnapshotInputs,
): PortfolioPhotoSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byCategory = new Map<PhotoCategory, number>();
  const jobs = new Set<string>();
  const photographers = new Set<string>();
  let totalPhotos = 0;
  let ytdPhotos = 0;

  for (const p of inputs.photos) {
    if (p.takenOn > asOf) continue;
    totalPhotos += 1;
    const cat: PhotoCategory = p.category ?? 'OTHER';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    jobs.add(p.jobId);
    if (p.photographerName) photographers.add(p.photographerName);
    if (Number(p.takenOn.slice(0, 4)) === logYear) ytdPhotos += 1;
  }

  const out: Partial<Record<PhotoCategory, number>> = {};
  for (const [k, v] of byCategory) out[k] = v;

  return {
    asOf,
    ytdLogYear: logYear,
    ytdPhotos,
    totalPhotos,
    byCategory: out,
    distinctJobs: jobs.size,
    distinctPhotographers: photographers.size,
  };
}
