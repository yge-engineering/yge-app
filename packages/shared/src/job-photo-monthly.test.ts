import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildJobPhotoMonthly } from './job-photo-monthly';

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
    latitude: 40,
    longitude: -122,
    ...over,
  } as Photo;
}

describe('buildJobPhotoMonthly', () => {
  it('groups by (jobId, month)', () => {
    const r = buildJobPhotoMonthly({
      photos: [
        ph({ id: 'a', jobId: 'j1', takenOn: '2026-03-15' }),
        ph({ id: 'b', jobId: 'j1', takenOn: '2026-04-15' }),
        ph({ id: 'c', jobId: 'j2', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts distinct days and photographers per pair', () => {
    const r = buildJobPhotoMonthly({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-15', photographerName: 'Brook' }),
        ph({ id: 'b', takenOn: '2026-04-15', photographerName: 'Ryan' }),
        ph({ id: 'c', takenOn: '2026-04-16', photographerName: 'Brook' }),
      ],
    });
    expect(r.rows[0]?.distinctDays).toBe(2);
    expect(r.rows[0]?.distinctPhotographers).toBe(2);
  });

  it('counts missingGps', () => {
    const r = buildJobPhotoMonthly({
      photos: [
        ph({ id: 'a' }),
        ph({ id: 'b', latitude: undefined }),
      ],
    });
    expect(r.rows[0]?.missingGps).toBe(1);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildJobPhotoMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      photos: [
        ph({ id: 'mar', takenOn: '2026-03-15' }),
        ph({ id: 'apr', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobPhotoMonthly({
      photos: [
        ph({ id: 'a', jobId: 'Z', takenOn: '2026-04-15' }),
        ph({ id: 'b', jobId: 'A', takenOn: '2026-04-15' }),
        ph({ id: 'c', jobId: 'A', takenOn: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('rolls up totals', () => {
    const r = buildJobPhotoMonthly({
      photos: [
        ph({ id: 'a', jobId: 'j1' }),
        ph({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.rollup.jobsConsidered).toBe(2);
    expect(r.rollup.total).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildJobPhotoMonthly({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
