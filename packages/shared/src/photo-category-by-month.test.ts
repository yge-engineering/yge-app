import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPhotoCategoryByMonth } from './photo-category-by-month';

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

describe('buildPhotoCategoryByMonth', () => {
  it('groups by (month, category)', () => {
    const r = buildPhotoCategoryByMonth({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-15', category: 'PROGRESS' }),
        ph({ id: 'b', takenOn: '2026-04-15', category: 'INCIDENT' }),
        ph({ id: 'c', takenOn: '2026-03-15', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts and tracks distinct jobs', () => {
    const r = buildPhotoCategoryByMonth({
      photos: [
        ph({ id: 'a', jobId: 'j1' }),
        ph({ id: 'b', jobId: 'j2' }),
        ph({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.count).toBe(3);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPhotoCategoryByMonth({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      photos: [
        ph({ id: 'mar', takenOn: '2026-03-15' }),
        ph({ id: 'apr', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('sorts by month asc, category asc', () => {
    const r = buildPhotoCategoryByMonth({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-15', category: 'INCIDENT' }),
        ph({ id: 'b', takenOn: '2026-03-15', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildPhotoCategoryByMonth({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
