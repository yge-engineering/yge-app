// Photo activity by day of week.
//
// Plain English: across the photo log, count by UTC day of week
// (Mon-first ordering). Useful for "we shoot most photos on
// Monday morning safety walks" pattern detection.
//
// Per row: dayOfWeek, label, count, distinctJobs,
// distinctPhotographers.
//
// Sort: Mon-first.
//
// Different from photo-by-month (per-month volume),
// daily-photo-activity (per-day timeline), photo-by-job (per-
// job rollup).
//
// Pure derivation. No persisted records.

import type { Photo } from './photo';

export interface PhotoByDayOfWeekRow {
  dayOfWeek: number;
  label: string;
  count: number;
  distinctJobs: number;
  distinctPhotographers: number;
}

export interface PhotoByDayOfWeekRollup {
  daysConsidered: number;
  total: number;
}

export interface PhotoByDayOfWeekInputs {
  photos: Photo[];
  /** Optional yyyy-mm-dd window applied to takenOn. */
  fromDate?: string;
  toDate?: string;
}

const LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SORT_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function buildPhotoByDayOfWeek(
  inputs: PhotoByDayOfWeekInputs,
): {
  rollup: PhotoByDayOfWeekRollup;
  rows: PhotoByDayOfWeekRow[];
} {
  type Acc = {
    count: number;
    jobs: Set<string>;
    photographers: Set<string>;
  };
  const accs = new Map<number, Acc>();
  let total = 0;

  for (const p of inputs.photos) {
    if (inputs.fromDate && p.takenOn < inputs.fromDate) continue;
    if (inputs.toDate && p.takenOn > inputs.toDate) continue;
    const dow = dayOfWeekUtc(p.takenOn);
    if (dow < 0) continue;
    total += 1;
    const acc = accs.get(dow) ?? {
      count: 0,
      jobs: new Set<string>(),
      photographers: new Set<string>(),
    };
    acc.count += 1;
    acc.jobs.add(p.jobId);
    if (p.photographerName && p.photographerName.trim()) {
      acc.photographers.add(p.photographerName.trim().toLowerCase());
    }
    accs.set(dow, acc);
  }

  const rows: PhotoByDayOfWeekRow[] = [];
  for (const dow of SORT_ORDER) {
    const acc = accs.get(dow);
    if (!acc) continue;
    rows.push({
      dayOfWeek: dow,
      label: LABELS[dow] ?? '',
      count: acc.count,
      distinctJobs: acc.jobs.size,
      distinctPhotographers: acc.photographers.size,
    });
  }

  return {
    rollup: {
      daysConsidered: rows.length,
      total,
    },
    rows,
  };
}

function dayOfWeekUtc(ymd: string): number {
  const t = Date.parse(ymd + 'T00:00:00Z');
  if (Number.isNaN(t)) return -1;
  return new Date(t).getUTCDay();
}
