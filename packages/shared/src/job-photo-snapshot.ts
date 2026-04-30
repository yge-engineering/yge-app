// Job-anchored photo snapshot.
//
// Plain English: for one job, as-of today, count photos,
// break down by category, count distinct photographers,
// surface YTD count + last photo date. Drives the right-now
// per-job photo-evidence overview.
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface JobPhotoSnapshotResult {
  asOf: string;
  jobId: string;
  totalPhotos: number;
  ytdPhotos: number;
  byCategory: Partial<Record<PhotoCategory, number>>;
  distinctPhotographers: number;
  lastPhotoDate: string | null;
}

export interface JobPhotoSnapshotInputs {
  jobId: string;
  photos: Photo[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year. Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildJobPhotoSnapshot(
  inputs: JobPhotoSnapshotInputs,
): JobPhotoSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byCategory = new Map<PhotoCategory, number>();
  const photographers = new Set<string>();
  let totalPhotos = 0;
  let ytdPhotos = 0;
  let lastPhotoDate: string | null = null;

  for (const p of inputs.photos) {
    if (p.jobId !== inputs.jobId) continue;
    if (p.takenOn > asOf) continue;
    totalPhotos += 1;
    const cat: PhotoCategory = p.category ?? 'OTHER';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    if (p.photographerName) photographers.add(p.photographerName);
    if (Number(p.takenOn.slice(0, 4)) === logYear) ytdPhotos += 1;
    if (lastPhotoDate == null || p.takenOn > lastPhotoDate) lastPhotoDate = p.takenOn;
  }

  const out: Partial<Record<PhotoCategory, number>> = {};
  for (const [k, v] of byCategory) out[k] = v;

  return {
    asOf,
    jobId: inputs.jobId,
    totalPhotos,
    ytdPhotos,
    byCategory: out,
    distinctPhotographers: photographers.size,
    lastPhotoDate,
  };
}
