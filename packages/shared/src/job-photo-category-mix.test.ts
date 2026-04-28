import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Photo } from './photo';

import { buildJobPhotoCategoryMix } from './job-photo-category-mix';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function ph(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Site',
    caption: 'Photo',
    category: 'PROGRESS',
    reference: 'IMG_001.jpg',
    ...over,
  } as Photo;
}

describe('buildJobPhotoCategoryMix', () => {
  it('counts photos per category', () => {
    const r = buildJobPhotoCategoryMix({
      jobs: [job({})],
      photos: [
        ph({ id: 'a', category: 'PROGRESS' }),
        ph({ id: 'b', category: 'PROGRESS' }),
        ph({ id: 'c', category: 'PRE_CONSTRUCTION' }),
        ph({ id: 'd', category: 'DELAY' }),
      ],
    });
    expect(r.rows[0]?.totalPhotos).toBe(4);
    const progress = r.rows[0]?.byCategory.find((x) => x.category === 'PROGRESS');
    expect(progress?.count).toBe(2);
    expect(progress?.share).toBe(0.5);
  });

  it('flags hasPreConstruction / hasCompletion / hasChangeOrder / hasSwppp', () => {
    const r = buildJobPhotoCategoryMix({
      jobs: [job({})],
      photos: [
        ph({ id: 'a', category: 'PRE_CONSTRUCTION' }),
        ph({ id: 'b', category: 'COMPLETION' }),
        ph({ id: 'c', category: 'CHANGE_ORDER' }),
        ph({ id: 'd', category: 'SWPPP' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.hasPreConstruction).toBe(true);
    expect(row?.hasCompletion).toBe(true);
    expect(row?.hasChangeOrder).toBe(true);
    expect(row?.hasSwppp).toBe(true);
  });

  it('warns when PRE_CONSTRUCTION is missing on a job with photos', () => {
    const r = buildJobPhotoCategoryMix({
      jobs: [job({})],
      photos: [
        ph({ id: 'a', category: 'PROGRESS' }),
        ph({ id: 'b', category: 'COMPLETION' }),
      ],
    });
    expect(r.rows[0]?.hasPreConstruction).toBe(false);
    const warnings = r.rows[0]?.warnings ?? [];
    expect(warnings.some((w) => w.includes('PRE_CONSTRUCTION'))).toBe(true);
  });

  it('warns when COMPLETION missing', () => {
    const r = buildJobPhotoCategoryMix({
      jobs: [job({})],
      photos: [
        ph({ id: 'a', category: 'PRE_CONSTRUCTION' }),
        ph({ id: 'b', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.hasCompletion).toBe(false);
    const warnings = r.rows[0]?.warnings ?? [];
    expect(warnings.some((w) => w.includes('COMPLETION'))).toBe(true);
  });

  it('warns when no photos at all', () => {
    const r = buildJobPhotoCategoryMix({
      jobs: [job({})],
      photos: [],
    });
    expect(r.rows[0]?.totalPhotos).toBe(0);
    const warnings = r.rows[0]?.warnings ?? [];
    expect(warnings.some((w) => w.toLowerCase().includes('no photos'))).toBe(true);
  });

  it('respects fromDate/toDate window', () => {
    const r = buildJobPhotoCategoryMix({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      photos: [
        ph({ id: 'old', takenOn: '2026-03-15' }),
        ph({ id: 'in', takenOn: '2026-04-15' }),
        ph({ id: 'after', takenOn: '2026-05-15' }),
      ],
    });
    expect(r.rows[0]?.totalPhotos).toBe(1);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobPhotoCategoryMix({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      photos: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts most-warnings first', () => {
    const r = buildJobPhotoCategoryMix({
      jobs: [
        job({ id: 'clean' }),
        job({ id: 'gappy' }),
      ],
      photos: [
        ph({ id: 'c1', jobId: 'clean', category: 'PRE_CONSTRUCTION' }),
        ph({ id: 'c2', jobId: 'clean', category: 'COMPLETION' }),
        // 'gappy' has no photos at all → 1 warning
      ],
    });
    expect(r.rows[0]?.jobId).toBe('gappy');
    expect(r.rows[1]?.jobId).toBe('clean');
  });

  it('rolls up jobsMissingPreConstruction / Completion', () => {
    const r = buildJobPhotoCategoryMix({
      jobs: [
        job({ id: 'a' }),
        job({ id: 'b' }),
      ],
      photos: [
        ph({ id: '1', jobId: 'a', category: 'PRE_CONSTRUCTION' }),
        ph({ id: '2', jobId: 'a', category: 'COMPLETION' }),
        // 'b' has no photos
      ],
    });
    expect(r.rollup.jobsMissingPreConstruction).toBe(1);
    expect(r.rollup.jobsMissingCompletion).toBe(1);
  });

  it('byCategory only includes categories that exist + sorts by count desc', () => {
    const r = buildJobPhotoCategoryMix({
      jobs: [job({})],
      photos: [
        ph({ id: 'a', category: 'PROGRESS' }),
        ph({ id: 'b', category: 'PROGRESS' }),
        ph({ id: 'c', category: 'PROGRESS' }),
        ph({ id: 'd', category: 'PRE_CONSTRUCTION' }),
      ],
    });
    const cats = r.rows[0]?.byCategory ?? [];
    expect(cats).toHaveLength(2);
    expect(cats[0]?.category).toBe('PROGRESS');
    expect(cats[0]?.count).toBe(3);
  });
});
