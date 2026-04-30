// Employee-anchored photo snapshot.
//
// Plain English: for one employee (matched by photographerName),
// as-of today, count photos they took, category mix, distinct
// jobs, last photo date.
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface EmployeePhotoSnapshotResult {
  asOf: string;
  employeeName: string;
  totalPhotos: number;
  ytdPhotos: number;
  byCategory: Partial<Record<PhotoCategory, number>>;
  distinctJobs: number;
  lastPhotoDate: string | null;
}

export interface EmployeePhotoSnapshotInputs {
  employeeName: string;
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEmployeePhotoSnapshot(
  inputs: EmployeePhotoSnapshotInputs,
): EmployeePhotoSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));
  const target = norm(inputs.employeeName);

  const byCategory = new Map<PhotoCategory, number>();
  const jobs = new Set<string>();
  let totalPhotos = 0;
  let ytdPhotos = 0;
  let lastPhotoDate: string | null = null;

  for (const p of inputs.photos) {
    if (norm(p.photographerName) !== target) continue;
    if (p.takenOn > asOf) continue;
    totalPhotos += 1;
    const cat: PhotoCategory = p.category ?? 'OTHER';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    jobs.add(p.jobId);
    if (Number(p.takenOn.slice(0, 4)) === logYear) ytdPhotos += 1;
    if (lastPhotoDate == null || p.takenOn > lastPhotoDate) lastPhotoDate = p.takenOn;
  }

  const out: Partial<Record<PhotoCategory, number>> = {};
  for (const [k, v] of byCategory) out[k] = v;

  return {
    asOf,
    employeeName: inputs.employeeName,
    totalPhotos,
    ytdPhotos,
    byCategory: out,
    distinctJobs: jobs.size,
    lastPhotoDate,
  };
}
