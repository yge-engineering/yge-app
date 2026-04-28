// Per-photographer photo activity.
//
// Plain English: field photos are evidence on delay claims, change
// orders, SWPPP audits, and incident reports. Some foremen take 30
// photos a week, some take none. This rolls the photo log up by
// photographer so we can see who's actually contributing the
// evidence and who needs a reminder.
//
// Per row: photographer name, total photos, distinct jobs touched,
// distinct days shooting, last takenOn, category mix
// (PROGRESS / DELAY / CHANGE_ORDER / SWPPP / INCIDENT / PUNCH /
// COMPLETION / PRE_CONSTRUCTION / OTHER), missingGps count.
//
// Sort by total photos desc.
//
// Different from photo-evidence (cross-reference index per photo),
// daily-photo-activity (count-per-day), dr-photo-coverage (per-DR),
// and job-photo-coverage (per-job). This is the photographer view.
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

export interface PhotoByPhotographerRow {
  photographerName: string;
  total: number;
  distinctJobs: number;
  distinctDays: number;
  lastTakenOn: string | null;
  missingGps: number;
  byCategory: Partial<Record<PhotoCategory, number>>;
}

export interface PhotoByPhotographerRollup {
  photographersConsidered: number;
  total: number;
  unattributed: number;
}

export interface PhotoByPhotographerInputs {
  photos: Photo[];
  /** Optional yyyy-mm-dd window applied to takenOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildPhotoByPhotographer(
  inputs: PhotoByPhotographerInputs,
): {
  rollup: PhotoByPhotographerRollup;
  rows: PhotoByPhotographerRow[];
} {
  type Acc = {
    display: string;
    total: number;
    jobs: Set<string>;
    days: Set<string>;
    lastTakenOn: string | null;
    missingGps: number;
    byCategory: Map<PhotoCategory, number>;
  };
  const accs = new Map<string, Acc>();
  let unattributed = 0;
  let total = 0;

  for (const p of inputs.photos) {
    if (inputs.fromDate && p.takenOn < inputs.fromDate) continue;
    if (inputs.toDate && p.takenOn > inputs.toDate) continue;
    total += 1;
    const display = (p.photographerName ?? '').trim();
    if (!display) {
      unattributed += 1;
      continue;
    }
    const key = display.toLowerCase();
    const acc = accs.get(key) ?? {
      display,
      total: 0,
      jobs: new Set<string>(),
      days: new Set<string>(),
      lastTakenOn: null,
      missingGps: 0,
      byCategory: new Map<PhotoCategory, number>(),
    };
    acc.total += 1;
    acc.jobs.add(p.jobId);
    acc.days.add(p.takenOn);
    if (!acc.lastTakenOn || p.takenOn > acc.lastTakenOn) acc.lastTakenOn = p.takenOn;
    if (p.latitude == null || p.longitude == null) acc.missingGps += 1;
    acc.byCategory.set(p.category, (acc.byCategory.get(p.category) ?? 0) + 1);
    accs.set(key, acc);
  }

  const rows: PhotoByPhotographerRow[] = [];
  for (const acc of accs.values()) {
    const byCategoryObj: Partial<Record<PhotoCategory, number>> = {};
    for (const [k, v] of acc.byCategory.entries()) byCategoryObj[k] = v;
    rows.push({
      photographerName: acc.display,
      total: acc.total,
      distinctJobs: acc.jobs.size,
      distinctDays: acc.days.size,
      lastTakenOn: acc.lastTakenOn,
      missingGps: acc.missingGps,
      byCategory: byCategoryObj,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  return {
    rollup: {
      photographersConsidered: rows.length,
      total,
      unattributed,
    },
    rows,
  };
}
