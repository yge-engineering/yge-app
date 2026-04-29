import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildJobPhotoByCategory } from './job-photo-by-category';

function ph(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Sta',
    caption: 'Test',
    category: 'PROGRESS',
    reference: 'IMG.jpg',
    ...over,
  } as Photo;
}

describe('buildJobPhotoByCategory', () => {
  it('groups by (job, category)', () => {
    const r = buildJobPhotoByCategory({
      photos: [
        ph({ id: 'a', jobId: 'j1', category: 'PROGRESS' }),
        ph({ id: 'b', jobId: 'j1', category: 'INCIDENT' }),
        ph({ id: 'c', jobId: 'j2', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts and tracks distinct days', () => {
    const r = buildJobPhotoByCategory({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-15' }),
        ph({ id: 'b', takenOn: '2026-04-16' }),
        ph({ id: 'c', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.count).toBe(3);
    expect(r.rows[0]?.distinctDays).toBe(2);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildJobPhotoByCategory({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      photos: [
        ph({ id: 'old', takenOn: '2026-03-15' }),
        ph({ id: 'in', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('sorts by job asc, count desc within job', () => {
    const r = buildJobPhotoByCategory({
      photos: [
        ph({ id: 'a', jobId: 'A', category: 'INCIDENT' }),
        ph({ id: 'b', jobId: 'A', category: 'PROGRESS' }),
        ph({ id: 'c', jobId: 'A', category: 'PROGRESS' }),
        ph({ id: 'd', jobId: 'A', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.category).toBe('PROGRESS');
  });

  it('handles empty input', () => {
    const r = buildJobPhotoByCategory({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
