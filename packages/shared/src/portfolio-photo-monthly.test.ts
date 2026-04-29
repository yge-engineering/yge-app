import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPortfolioPhotoMonthly } from './portfolio-photo-monthly';

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
    reference: 'IMG_001.jpg',
    ...over,
  } as Photo;
}

describe('buildPortfolioPhotoMonthly', () => {
  it('breaks down by category', () => {
    const r = buildPortfolioPhotoMonthly({
      photos: [
        photo({ id: 'a', category: 'PROGRESS' }),
        photo({ id: 'b', category: 'DELAY' }),
        photo({ id: 'c', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.byCategory.PROGRESS).toBe(2);
    expect(r.rows[0]?.byCategory.DELAY).toBe(1);
  });

  it('counts distinct jobs + photographers', () => {
    const r = buildPortfolioPhotoMonthly({
      photos: [
        photo({ id: 'a', jobId: 'j1', photographerName: 'Pat' }),
        photo({ id: 'b', jobId: 'j2', photographerName: 'Sam' }),
        photo({ id: 'c', jobId: 'j1', photographerName: 'Pat' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctPhotographers).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioPhotoMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      photos: [
        photo({ id: 'old', takenOn: '2026-03-15' }),
        photo({ id: 'in', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPhotos).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioPhotoMonthly({
      photos: [
        photo({ id: 'a', takenOn: '2026-06-15' }),
        photo({ id: 'b', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioPhotoMonthly({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
