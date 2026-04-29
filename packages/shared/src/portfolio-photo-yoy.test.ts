import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPortfolioPhotoYoy } from './portfolio-photo-yoy';

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

describe('buildPortfolioPhotoYoy', () => {
  it('compares prior vs current', () => {
    const r = buildPortfolioPhotoYoy({
      currentYear: 2026,
      photos: [
        photo({ id: 'a', takenOn: '2025-04-15' }),
        photo({ id: 'b', takenOn: '2026-04-15' }),
        photo({ id: 'c', takenOn: '2026-05-01' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.totalDelta).toBe(1);
  });

  it('breaks down by category per year', () => {
    const r = buildPortfolioPhotoYoy({
      currentYear: 2026,
      photos: [
        photo({ id: 'a', takenOn: '2025-04-15', category: 'PROGRESS' }),
        photo({ id: 'b', takenOn: '2026-04-15', category: 'DELAY' }),
        photo({ id: 'c', takenOn: '2026-05-01', category: 'DELAY' }),
      ],
    });
    expect(r.priorByCategory.PROGRESS).toBe(1);
    expect(r.currentByCategory.DELAY).toBe(2);
  });

  it('counts distinct jobs + photographers per year', () => {
    const r = buildPortfolioPhotoYoy({
      currentYear: 2026,
      photos: [
        photo({ id: 'a', takenOn: '2026-04-15', jobId: 'j1', photographerName: 'Pat' }),
        photo({ id: 'b', takenOn: '2026-04-16', jobId: 'j2', photographerName: 'Sam' }),
      ],
    });
    expect(r.currentDistinctJobs).toBe(2);
    expect(r.currentDistinctPhotographers).toBe(2);
  });

  it('ignores photos outside the two-year window', () => {
    const r = buildPortfolioPhotoYoy({
      currentYear: 2026,
      photos: [photo({ id: 'a', takenOn: '2024-04-15' })],
    });
    expect(r.priorTotal).toBe(0);
    expect(r.currentTotal).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioPhotoYoy({ currentYear: 2026, photos: [] });
    expect(r.priorTotal).toBe(0);
    expect(r.currentTotal).toBe(0);
  });
});
