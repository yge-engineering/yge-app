import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPhotoByPhotographer } from './photo-by-photographer';

function ph(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Sta 12+50',
    caption: 'Subgrade prep',
    photographerName: 'Brook Young',
    category: 'PROGRESS',
    reference: 'IMG-001.jpg',
    latitude: 40.123,
    longitude: -122.456,
    ...over,
  } as Photo;
}

describe('buildPhotoByPhotographer', () => {
  it('groups photos by photographer (case-insensitive)', () => {
    const r = buildPhotoByPhotographer({
      photos: [
        ph({ id: 'a', photographerName: 'Brook Young' }),
        ph({ id: 'b', photographerName: 'BROOK YOUNG' }),
        ph({ id: 'c', photographerName: 'brook young' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.total).toBe(3);
  });

  it('counts distinct jobs and distinct days', () => {
    const r = buildPhotoByPhotographer({
      photos: [
        ph({ id: 'a', jobId: 'j1', takenOn: '2026-04-15' }),
        ph({ id: 'b', jobId: 'j1', takenOn: '2026-04-15' }),
        ph({ id: 'c', jobId: 'j2', takenOn: '2026-04-16' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctDays).toBe(2);
  });

  it('tracks last takenOn date', () => {
    const r = buildPhotoByPhotographer({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-10' }),
        ph({ id: 'b', takenOn: '2026-04-20' }),
        ph({ id: 'c', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.lastTakenOn).toBe('2026-04-20');
  });

  it('counts missingGps correctly', () => {
    const r = buildPhotoByPhotographer({
      photos: [
        ph({ id: 'gps', latitude: 40.1, longitude: -122.5 }),
        ph({ id: 'nolat', latitude: undefined, longitude: -122.5 }),
        ph({ id: 'nolong', latitude: 40.1, longitude: undefined }),
      ],
    });
    expect(r.rows[0]?.missingGps).toBe(2);
  });

  it('breaks down photos by category', () => {
    const r = buildPhotoByPhotographer({
      photos: [
        ph({ id: 'a', category: 'PROGRESS' }),
        ph({ id: 'b', category: 'PROGRESS' }),
        ph({ id: 'c', category: 'INCIDENT' }),
      ],
    });
    expect(r.rows[0]?.byCategory.PROGRESS).toBe(2);
    expect(r.rows[0]?.byCategory.INCIDENT).toBe(1);
  });

  it('counts unattributed photos in the rollup but not in rows', () => {
    const r = buildPhotoByPhotographer({
      photos: [
        ph({ id: 'attributed', photographerName: 'Brook Young' }),
        ph({ id: 'noname', photographerName: undefined }),
        ph({ id: 'blank', photographerName: '   ' }),
      ],
    });
    expect(r.rollup.total).toBe(3);
    expect(r.rollup.unattributed).toBe(2);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildPhotoByPhotographer({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      photos: [
        ph({ id: 'old', takenOn: '2026-03-15' }),
        ph({ id: 'in', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('sorts photographers by total photos desc', () => {
    const r = buildPhotoByPhotographer({
      photos: [
        ph({ id: 's', photographerName: 'Small' }),
        ph({ id: 'b1', photographerName: 'Big' }),
        ph({ id: 'b2', photographerName: 'Big' }),
        ph({ id: 'b3', photographerName: 'Big' }),
      ],
    });
    expect(r.rows[0]?.photographerName).toBe('Big');
  });

  it('handles empty input', () => {
    const r = buildPhotoByPhotographer({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
