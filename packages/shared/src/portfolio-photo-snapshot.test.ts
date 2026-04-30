import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPortfolioPhotoSnapshot } from './portfolio-photo-snapshot';

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

describe('buildPortfolioPhotoSnapshot', () => {
  it('counts total + ytd', () => {
    const r = buildPortfolioPhotoSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      photos: [
        photo({ id: 'a', takenOn: '2025-04-15' }),
        photo({ id: 'b', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.totalPhotos).toBe(2);
    expect(r.ytdPhotos).toBe(1);
  });

  it('breaks down by category', () => {
    const r = buildPortfolioPhotoSnapshot({
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

  it('counts distinct jobs + photographers', () => {
    const r = buildPortfolioPhotoSnapshot({
      asOf: '2026-04-30',
      photos: [
        photo({ id: 'a', jobId: 'j1', photographerName: 'Pat' }),
        photo({ id: 'b', jobId: 'j2', photographerName: 'Sam' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
    expect(r.distinctPhotographers).toBe(2);
  });

  it('ignores photos after asOf', () => {
    const r = buildPortfolioPhotoSnapshot({
      asOf: '2026-04-30',
      photos: [photo({ id: 'late', takenOn: '2026-05-15' })],
    });
    expect(r.totalPhotos).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioPhotoSnapshot({ photos: [] });
    expect(r.totalPhotos).toBe(0);
  });
});
