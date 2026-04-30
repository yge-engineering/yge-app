import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildEmployeePhotoYoy } from './employee-photo-yoy';

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

describe('buildEmployeePhotoYoy', () => {
  it('compares two years for one photographer', () => {
    const r = buildEmployeePhotoYoy({
      employeeName: 'Pat',
      currentYear: 2026,
      photos: [
        photo({ id: 'a', takenOn: '2025-04-15' }),
        photo({ id: 'b', takenOn: '2026-04-15' }),
        photo({ id: 'c', takenOn: '2026-08-15' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.totalDelta).toBe(1);
  });

  it('handles unknown photographer', () => {
    const r = buildEmployeePhotoYoy({
      employeeName: 'X',
      currentYear: 2026,
      photos: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
