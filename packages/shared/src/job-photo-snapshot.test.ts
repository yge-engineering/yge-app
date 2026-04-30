import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildJobPhotoSnapshot } from './job-photo-snapshot';

function photo(over: Partial<Photo>): Photo {
  return {
    id: 'p-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Bay 1',
    caption: 'Pour',
    category: 'PROGRESS',
    photographerName: 'Pat',
    reference: 'IMG.jpg',
    ...over,
  } as Photo;
}

describe('buildJobPhotoSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobPhotoSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      photos: [
        photo({ id: 'a', jobId: 'j1' }),
        photo({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalPhotos).toBe(1);
  });

  it('counts ytd', () => {
    const r = buildJobPhotoSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      logYear: 2026,
      photos: [
        photo({ id: 'a', takenOn: '2025-04-15' }),
        photo({ id: 'b', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.ytdPhotos).toBe(1);
  });

  it('breaks down by category', () => {
    const r = buildJobPhotoSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      photos: [
        photo({ id: 'a', category: 'PROGRESS' }),
        photo({ id: 'b', category: 'DELAY' }),
        photo({ id: 'c', category: 'PROGRESS' }),
      ],
    });
    expect(r.byCategory.PROGRESS).toBe(2);
    expect(r.byCategory.DELAY).toBe(1);
  });

  it('counts distinct photographers + last photo date', () => {
    const r = buildJobPhotoSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      photos: [
        photo({ id: 'a', photographerName: 'Pat', takenOn: '2026-04-10' }),
        photo({ id: 'b', photographerName: 'Sam', takenOn: '2026-04-22' }),
      ],
    });
    expect(r.distinctPhotographers).toBe(2);
    expect(r.lastPhotoDate).toBe('2026-04-22');
  });

  it('handles no matching photos', () => {
    const r = buildJobPhotoSnapshot({ jobId: 'j1', photos: [] });
    expect(r.totalPhotos).toBe(0);
    expect(r.lastPhotoDate).toBeNull();
  });
});
