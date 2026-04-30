// Customer-anchored photo snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count photos across all their jobs, category
// mix, distinct photographers + jobs, last photo date. Drives
// the right-now per-customer photo-evidence overview.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Photo, PhotoCategory } from './photo';

export interface CustomerPhotoSnapshotResult {
  asOf: string;
  customerName: string;
  totalPhotos: number;
  ytdPhotos: number;
  byCategory: Partial<Record<PhotoCategory, number>>;
  distinctPhotographers: number;
  distinctJobs: number;
  lastPhotoDate: string | null;
}

export interface CustomerPhotoSnapshotInputs {
  customerName: string;
  photos: Photo[];
  jobs: Job[];
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

export function buildCustomerPhotoSnapshot(
  inputs: CustomerPhotoSnapshotInputs,
): CustomerPhotoSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));
  const target = norm(inputs.customerName);

  const jobIds = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) jobIds.add(j.id);
  }

  const byCategory = new Map<PhotoCategory, number>();
  const photographers = new Set<string>();
  const jobs = new Set<string>();
  let totalPhotos = 0;
  let ytdPhotos = 0;
  let lastPhotoDate: string | null = null;

  for (const p of inputs.photos) {
    if (!jobIds.has(p.jobId)) continue;
    if (p.takenOn > asOf) continue;
    totalPhotos += 1;
    const cat: PhotoCategory = p.category ?? 'OTHER';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    if (p.photographerName) photographers.add(p.photographerName);
    jobs.add(p.jobId);
    if (Number(p.takenOn.slice(0, 4)) === logYear) ytdPhotos += 1;
    if (lastPhotoDate == null || p.takenOn > lastPhotoDate) lastPhotoDate = p.takenOn;
  }

  const out: Partial<Record<PhotoCategory, number>> = {};
  for (const [k, v] of byCategory) out[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalPhotos,
    ytdPhotos,
    byCategory: out,
    distinctPhotographers: photographers.size,
    distinctJobs: jobs.size,
    lastPhotoDate,
  };
}
