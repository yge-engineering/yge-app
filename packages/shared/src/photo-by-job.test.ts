import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPhotoByJob } from './photo-by-job';

function ph(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Sta 12',
    caption: 'Test',
    photographerName: 'Brook',
    category: 'PROGRESS',
    reference: 'IMG-001.jpg',
    latitude: 40.123,
    longitude: -122.456,
    ...over,
  } as Photo;
}

describe('buildPhotoByJob', () => {
  it('groups photos by jobId', () => {
    const r = buildPhotoByJob({
      photos: [
        ph({ id: 'a', jobId: 'j1' }),
        ph({ id: 'b', jobId: 'j1' }),
        ph({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts distinct days and photographers', () => {
    const r = buildPhotoByJob({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-15', photographerName: 'Brook' }),
        ph({ id: 'b', takenOn: '2026-04-16', photographerName: 'Brook' }),
        ph({ id: 'c', takenOn: '2026-04-15', photographerName: 'Ryan' }),
      ],
    });
    expect(r.rows[0]?.distinctDays).toBe(2);
    expect(r.rows[0]?.distinctPhotographers).toBe(2);
  });

  it('counts missingGps', () => {
    const r = buildPhotoByJob({
      photos: [
        ph({ id: 'gps' }),
        ph({ id: 'nolat', latitude: undefined }),
      ],
    });
    expect(r.rows[0]?.missingGps).toBe(1);
  });

  it('tracks last takenOn date', () => {
    const r = buildPhotoByJob({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-10' }),
        ph({ id: 'b', takenOn: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.lastTakenOn).toBe('2026-04-20');
  });

  it('breaks down by category', () => {
    const r = buildPhotoByJob({
      photos: [
        ph({ id: 'a', category: 'PROGRESS' }),
        ph({ id: 'b', category: 'INCIDENT' }),
        ph({ id: 'c', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.byCategory.PROGRESS).toBe(2);
    expect(r.rows[0]?.byCategory.INCIDENT).toBe(1);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildPhotoByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      photos: [
        ph({ id: 'old', takenOn: '2026-03-15' }),
        ph({ id: 'in', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('sorts by total desc', () => {
    const r = buildPhotoByJob({
      photos: [
        ph({ id: 's', jobId: 'small' }),
        ph({ id: 'b1', jobId: 'big' }),
        ph({ id: 'b2', jobId: 'big' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildPhotoByJob({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
