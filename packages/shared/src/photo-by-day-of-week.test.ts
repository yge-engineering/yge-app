import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPhotoByDayOfWeek } from './photo-by-day-of-week';

function ph(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Sta',
    caption: 'Test',
    photographerName: 'Brook',
    category: 'PROGRESS',
    reference: 'IMG.jpg',
    ...over,
  } as Photo;
}

describe('buildPhotoByDayOfWeek', () => {
  it('groups by day of week', () => {
    const r = buildPhotoByDayOfWeek({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-15' }), // Wed
        ph({ id: 'b', takenOn: '2026-04-15' }), // Wed
        ph({ id: 'c', takenOn: '2026-04-13' }), // Mon
      ],
    });
    expect(r.rows).toHaveLength(2);
    const wed = r.rows.find((x) => x.label === 'Wednesday');
    expect(wed?.count).toBe(2);
  });

  it('counts distinct jobs and photographers', () => {
    const r = buildPhotoByDayOfWeek({
      photos: [
        ph({ id: 'a', jobId: 'j1', photographerName: 'Brook' }),
        ph({ id: 'b', jobId: 'j2', photographerName: 'Ryan' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctPhotographers).toBe(2);
  });

  it('sorts Mon-first', () => {
    const r = buildPhotoByDayOfWeek({
      photos: [
        ph({ id: 'sun', takenOn: '2026-04-19' }),
        ph({ id: 'mon', takenOn: '2026-04-13' }),
        ph({ id: 'sat', takenOn: '2026-04-18' }),
      ],
    });
    expect(r.rows.map((x) => x.label)).toEqual(['Monday', 'Saturday', 'Sunday']);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildPhotoByDayOfWeek({
      fromDate: '2026-04-14',
      toDate: '2026-04-30',
      photos: [
        ph({ id: 'old', takenOn: '2026-04-13' }),
        ph({ id: 'in', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPhotoByDayOfWeek({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
