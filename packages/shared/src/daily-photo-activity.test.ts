import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildDailyPhotoActivity } from './daily-photo-activity';

function ph(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'site',
    caption: 'p',
    category: 'PROGRESS',
    reference: 'IMG.jpg',
    ...over,
  } as Photo;
}

describe('buildDailyPhotoActivity', () => {
  it('buckets photos by takenOn date', () => {
    const r = buildDailyPhotoActivity({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-15' }),
        ph({ id: 'b', takenOn: '2026-04-15' }),
        ph({ id: 'c', takenOn: '2026-04-16' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    expect(r.rows.find((x) => x.date === '2026-04-15')?.totalPhotos).toBe(2);
  });

  it('counts distinct jobs + photographers per day', () => {
    const r = buildDailyPhotoActivity({
      photos: [
        ph({ id: 'a', jobId: 'j1', photographerName: 'Alice' }),
        ph({ id: 'b', jobId: 'j2', photographerName: 'Bob' }),
        ph({ id: 'c', jobId: 'j1', photographerName: 'Alice' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctPhotographers).toBe(2);
  });

  it('counts photos per category', () => {
    const r = buildDailyPhotoActivity({
      photos: [
        ph({ id: 'a', category: 'PROGRESS' }),
        ph({ id: 'b', category: 'DELAY' }),
        ph({ id: 'c', category: 'PROGRESS' }),
        ph({ id: 'd', category: 'SWPPP' }),
      ],
    });
    expect(r.rows[0]?.countsByCategory.PROGRESS).toBe(2);
    expect(r.rows[0]?.countsByCategory.DELAY).toBe(1);
    expect(r.rows[0]?.countsByCategory.SWPPP).toBe(1);
  });

  it('respects fromDate/toDate window', () => {
    const r = buildDailyPhotoActivity({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      photos: [
        ph({ id: 'old', takenOn: '2026-03-15' }),
        ph({ id: 'in', takenOn: '2026-04-15' }),
        ph({ id: 'after', takenOn: '2026-05-15' }),
      ],
    });
    expect(r.rollup.totalPhotos).toBe(1);
  });

  it('captures peak date', () => {
    const r = buildDailyPhotoActivity({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-15' }),
        ph({ id: 'b', takenOn: '2026-04-16' }),
        ph({ id: 'c', takenOn: '2026-04-16' }),
        ph({ id: 'd', takenOn: '2026-04-16' }),
      ],
    });
    expect(r.rollup.peakDate).toBe('2026-04-16');
    expect(r.rollup.peakCount).toBe(3);
  });

  it('sorts rows by date asc', () => {
    const r = buildDailyPhotoActivity({
      photos: [
        ph({ id: 'late', takenOn: '2026-04-25' }),
        ph({ id: 'early', takenOn: '2026-04-05' }),
      ],
    });
    expect(r.rows[0]?.date).toBe('2026-04-05');
  });

  it('handles empty input', () => {
    const r = buildDailyPhotoActivity({ photos: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakDate).toBe(null);
  });
});
