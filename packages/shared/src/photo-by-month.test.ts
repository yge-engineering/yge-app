import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPhotoByMonth } from './photo-by-month';

function ph(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Sta 12+50',
    caption: 'Subgrade prep',
    photographerName: 'Brook',
    category: 'PROGRESS',
    reference: 'IMG-001.jpg',
    latitude: 40.123,
    longitude: -122.456,
    ...over,
  } as Photo;
}

describe('buildPhotoByMonth', () => {
  it('buckets photos by yyyy-mm', () => {
    const r = buildPhotoByMonth({
      photos: [
        ph({ id: 'a', takenOn: '2026-03-15' }),
        ph({ id: 'b', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('breaks down by category', () => {
    const r = buildPhotoByMonth({
      photos: [
        ph({ id: 'a', category: 'PROGRESS' }),
        ph({ id: 'b', category: 'PROGRESS' }),
        ph({ id: 'c', category: 'INCIDENT' }),
      ],
    });
    expect(r.rows[0]?.byCategory.PROGRESS).toBe(2);
    expect(r.rows[0]?.byCategory.INCIDENT).toBe(1);
  });

  it('counts distinct jobs and photographers per month', () => {
    const r = buildPhotoByMonth({
      photos: [
        ph({ id: 'a', jobId: 'j1', photographerName: 'Brook' }),
        ph({ id: 'b', jobId: 'j2', photographerName: 'Brook' }),
        ph({ id: 'c', jobId: 'j1', photographerName: 'Ryan' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctPhotographers).toBe(2);
  });

  it('counts missingGps per month', () => {
    const r = buildPhotoByMonth({
      photos: [
        ph({ id: 'gps' }),
        ph({ id: 'nolat', latitude: undefined }),
        ph({ id: 'nolong', longitude: undefined }),
      ],
    });
    expect(r.rows[0]?.missingGps).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildPhotoByMonth({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      photos: [
        ph({ id: 'mar', takenOn: '2026-03-15' }),
        ph({ id: 'apr', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month count change', () => {
    const r = buildPhotoByMonth({
      photos: [
        ph({ id: 'mar1', takenOn: '2026-03-15' }),
        ph({ id: 'apr1', takenOn: '2026-04-10' }),
        ph({ id: 'apr2', takenOn: '2026-04-15' }),
        ph({ id: 'apr3', takenOn: '2026-04-20' }),
      ],
    });
    expect(r.rollup.monthOverMonthCountChange).toBe(2);
  });

  it('sorts by month asc', () => {
    const r = buildPhotoByMonth({
      photos: [
        ph({ id: 'late', takenOn: '2026-04-15' }),
        ph({ id: 'early', takenOn: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildPhotoByMonth({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
