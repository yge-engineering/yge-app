import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildJobPhotoYoy } from './job-photo-yoy';

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

describe('buildJobPhotoYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobPhotoYoy({
      jobId: 'j1',
      currentYear: 2026,
      photos: [
        photo({ id: 'a', takenOn: '2025-04-15' }),
        photo({ id: 'b', takenOn: '2026-04-15' }),
        photo({ id: 'c', takenOn: '2026-08-15', jobId: 'j2' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobPhotoYoy({ jobId: 'X', currentYear: 2026, photos: [] });
    expect(r.priorTotal).toBe(0);
  });
});
