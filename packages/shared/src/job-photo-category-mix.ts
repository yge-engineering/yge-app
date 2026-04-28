// Per-job photo category mix.
//
// Plain English: for each AWARDED job, break down the photo log
// by PhotoCategory (PROGRESS / PRE_CONSTRUCTION / DELAY /
// CHANGE_ORDER / SWPPP / INCIDENT / PUNCH / COMPLETION / OTHER).
// Surfaces gaps that kill claims:
//   - no PRE_CONSTRUCTION photos → differing-site-condition
//     defense is weak (you can't show the existing condition)
//   - no COMPLETION photos → substantial-completion claim is
//     weak (you can't show the punch is closed)
//   - high CHANGE_ORDER photo share → the job is full of CO
//     scope, useful for tracking
//
// Different from job-photo-coverage (DR-day coverage rate),
// dr-photo-coverage (per-DR average), and photo-evidence
// (per-photo evidence index). This is the per-job "what kinds
// of evidence do we have?" view.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Photo, PhotoCategory } from './photo';

export interface JobPhotoCategoryRow {
  category: PhotoCategory;
  count: number;
  /** count / total photos on this job. 0 when no photos. */
  share: number;
}

export interface JobPhotoMixRow {
  jobId: string;
  projectName: string;
  totalPhotos: number;
  /** Whether PRE_CONSTRUCTION photos exist — defense killer if false. */
  hasPreConstruction: boolean;
  hasCompletion: boolean;
  hasChangeOrder: boolean;
  hasSwppp: boolean;
  byCategory: JobPhotoCategoryRow[];
  /** Soft warnings — strings the UI can render in red. */
  warnings: string[];
}

export interface JobPhotoMixRollup {
  jobsConsidered: number;
  totalPhotos: number;
  jobsMissingPreConstruction: number;
  jobsMissingCompletion: number;
}

export interface JobPhotoMixInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  photos: Photo[];
  /** Default false — only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
  /** Optional inclusive yyyy-mm-dd window applied to takenOn. */
  fromDate?: string;
  toDate?: string;
}

const ALL_CATEGORIES: PhotoCategory[] = [
  'PROGRESS',
  'PRE_CONSTRUCTION',
  'DELAY',
  'CHANGE_ORDER',
  'SWPPP',
  'INCIDENT',
  'PUNCH',
  'COMPLETION',
  'OTHER',
];

export function buildJobPhotoCategoryMix(
  inputs: JobPhotoMixInputs,
): {
  rollup: JobPhotoMixRollup;
  rows: JobPhotoMixRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // Bucket photos by jobId.
  const byJob = new Map<string, Photo[]>();
  for (const p of inputs.photos) {
    if (inputs.fromDate && p.takenOn < inputs.fromDate) continue;
    if (inputs.toDate && p.takenOn > inputs.toDate) continue;
    const list = byJob.get(p.jobId) ?? [];
    list.push(p);
    byJob.set(p.jobId, list);
  }

  let totalPhotos = 0;
  let missingPre = 0;
  let missingCompletion = 0;

  const rows: JobPhotoMixRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const photos = byJob.get(j.id) ?? [];

    const counts = new Map<PhotoCategory, number>();
    for (const cat of ALL_CATEGORIES) counts.set(cat, 0);
    for (const p of photos) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }

    const total = photos.length;
    const byCategory: JobPhotoCategoryRow[] = ALL_CATEGORIES
      .map((cat) => ({
        category: cat,
        count: counts.get(cat) ?? 0,
        share: total === 0 ? 0 : Math.round(((counts.get(cat) ?? 0) / total) * 10_000) / 10_000,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);

    const hasPre = (counts.get('PRE_CONSTRUCTION') ?? 0) > 0;
    const hasCompletion = (counts.get('COMPLETION') ?? 0) > 0;
    const hasChangeOrder = (counts.get('CHANGE_ORDER') ?? 0) > 0;
    const hasSwppp = (counts.get('SWPPP') ?? 0) > 0;

    const warnings: string[] = [];
    if (!hasPre && total > 0) {
      warnings.push('No PRE_CONSTRUCTION photos — differing-site-condition defense is weak.');
    }
    if (!hasCompletion && total > 0) {
      warnings.push('No COMPLETION photos — substantial-completion claim is weak.');
    }
    if (total === 0) {
      warnings.push('No photos at all on this job.');
    }

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      totalPhotos: total,
      hasPreConstruction: hasPre,
      hasCompletion: hasCompletion,
      hasChangeOrder: hasChangeOrder,
      hasSwppp: hasSwppp,
      byCategory,
      warnings,
    });

    totalPhotos += total;
    if (!hasPre) missingPre += 1;
    if (!hasCompletion) missingCompletion += 1;
  }

  // Sort: most-warnings first (jobs needing attention), then by total photos desc.
  rows.sort((a, b) => {
    if (a.warnings.length !== b.warnings.length) {
      return b.warnings.length - a.warnings.length;
    }
    return b.totalPhotos - a.totalPhotos;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalPhotos,
      jobsMissingPreConstruction: missingPre,
      jobsMissingCompletion: missingCompletion,
    },
    rows,
  };
}
