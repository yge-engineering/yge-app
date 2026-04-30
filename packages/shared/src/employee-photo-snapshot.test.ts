import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildEmployeePhotoSnapshot } from './employee-photo-snapshot';

function photo(over: Partial<Photo>): Photo {
  return {
    id: 'p-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Bay 1',
    caption: 'X',
    category: 'PROGRESS',
    photographerName: 'Pat',
    reference: 'IMG.jpg',
    ...over,
  } as Photo;
}

describe('buildEmployeePhotoSnapshot', () => {
  it('matches via photographer name (case-insensitive)', () => {
    const r = buildEmployeePhotoSnapshot({
      employeeName: 'Pat',
      asOf: '2026-04-30',
      photos: [
        photo({ id: 'a', photographerName: 'Pat' }),
        photo({ id: 'b', photographerName: 'PAT' }),
        photo({ id: 'c', photographerName: 'Sam' }),
      ],
    });
    expect(r.totalPhotos).toBe(2);
  });

  it('breaks down by category + tracks last date', () => {
    const r = buildEmployeePhotoSnapshot({
      employeeName: 'Pat',
      asOf: '2026-04-30',
      photos: [
        photo({ id: 'a', category: 'PROGRESS', takenOn: '2026-04-08' }),
        photo({ id: 'b', category: 'DELAY', takenOn: '2026-04-22' }),
      ],
    });
    expect(r.byCategory.PROGRESS).toBe(1);
    expect(r.byCategory.DELAY).toBe(1);
    expect(r.lastPhotoDate).toBe('2026-04-22');
  });

  it('counts ytd', () => {
    const r = buildEmployeePhotoSnapshot({
      employeeName: 'Pat',
      asOf: '2026-04-30',
      logYear: 2026,
      photos: [
        photo({ id: 'a', takenOn: '2025-04-15' }),
        photo({ id: 'b', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.ytdPhotos).toBe(1);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeePhotoSnapshot({ employeeName: 'X', photos: [] });
    expect(r.totalPhotos).toBe(0);
  });
});
