// Customer-anchored per-job photo detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: photo count, last photo date,
// distinct photographers. Sorted by photo count descending.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Photo } from './photo';

export interface CustomerPhotoDetailRow {
  jobId: string;
  photos: number;
  distinctPhotographers: number;
  lastPhotoDate: string | null;
}

export interface CustomerPhotoDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerPhotoDetailRow[];
}

export interface CustomerPhotoDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  photos: Photo[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
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

export function buildCustomerPhotoDetailSnapshot(
  inputs: CustomerPhotoDetailSnapshotInputs,
): CustomerPhotoDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = { count: number; photographers: Set<string>; lastDate: string | null };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { count: 0, photographers: new Set(), lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const p of inputs.photos) {
    if (!customerJobs.has(p.jobId)) continue;
    if (p.takenOn > asOf) continue;
    const a = getAcc(p.jobId);
    a.count += 1;
    if (p.photographerName) a.photographers.add(p.photographerName);
    if (a.lastDate == null || p.takenOn > a.lastDate) a.lastDate = p.takenOn;
  }

  const rows: CustomerPhotoDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      photos: a.count,
      distinctPhotographers: a.photographers.size,
      lastPhotoDate: a.lastDate,
    }))
    .sort((a, b) => b.photos - a.photos || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
