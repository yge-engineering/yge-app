// Per-job photo cadence (gap detector).
//
// Plain English: for each AWARDED-or-active job with photos,
// compute the average days between consecutive photos and the
// largest gap. Long gaps mean we went a stretch without
// photographing the work — claim defense and CO substantiation
// gets weaker the longer the gap.
//
// Per row: jobId, photoCount, firstTakenOn, lastTakenOn,
// avgDaysBetween, maxGapDays, daysSinceLast.
//
// Sort by maxGapDays desc.
//
// Different from photo-by-job (counts, no cadence math),
// job-photo-coverage (windowed coverage flag), photo-evidence
// (per-photo cross-ref). This is the gap-spotter view.
//
// Pure derivation. No persisted records.

import type { Photo } from './photo';

export interface PhotoCadenceByJobRow {
  jobId: string;
  photoCount: number;
  firstTakenOn: string;
  lastTakenOn: string;
  avgDaysBetween: number;
  maxGapDays: number;
  daysSinceLast: number;
}

export interface PhotoCadenceByJobRollup {
  jobsConsidered: number;
  totalPhotos: number;
}

export interface PhotoCadenceByJobInputs {
  photos: Photo[];
  /** Reference 'now' as yyyy-mm-dd. Defaults to today. */
  asOf?: string;
}

export function buildPhotoCadenceByJob(
  inputs: PhotoCadenceByJobInputs,
): {
  rollup: PhotoCadenceByJobRollup;
  rows: PhotoCadenceByJobRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const asOfMs = Date.parse(asOf + 'T00:00:00Z');

  const byJob = new Map<string, string[]>();
  for (const p of inputs.photos) {
    const arr = byJob.get(p.jobId) ?? [];
    arr.push(p.takenOn);
    byJob.set(p.jobId, arr);
  }

  const rows: PhotoCadenceByJobRow[] = [];
  let totalPhotos = 0;

  for (const [jobId, dates] of byJob.entries()) {
    if (dates.length === 0) continue;
    dates.sort();
    const first = dates[0]!;
    const last = dates[dates.length - 1]!;
    let maxGap = 0;
    let totalGap = 0;
    let pairs = 0;
    for (let i = 1; i < dates.length; i += 1) {
      const days = daysBetween(dates[i - 1]!, dates[i]!);
      totalGap += days;
      if (days > maxGap) maxGap = days;
      pairs += 1;
    }
    const avg = pairs === 0 ? 0 : Math.round((totalGap / pairs) * 100) / 100;
    const lastMs = Date.parse(last + 'T00:00:00Z');
    const daysSince = Number.isNaN(lastMs)
      ? 0
      : Math.max(0, Math.floor((asOfMs - lastMs) / 86_400_000));
    rows.push({
      jobId,
      photoCount: dates.length,
      firstTakenOn: first,
      lastTakenOn: last,
      avgDaysBetween: avg,
      maxGapDays: maxGap,
      daysSinceLast: daysSince,
    });
    totalPhotos += dates.length;
  }

  rows.sort((a, b) => b.maxGapDays - a.maxGapDays);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalPhotos,
    },
    rows,
  };
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
