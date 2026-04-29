import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPhotoCadenceByJob } from './photo-cadence-by-job';

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

describe('buildPhotoCadenceByJob', () => {
  it('groups by jobId and tracks first/last takenOn', () => {
    const r = buildPhotoCadenceByJob({
      asOf: '2026-04-30',
      photos: [
        ph({ id: 'a', jobId: 'j1', takenOn: '2026-04-01' }),
        ph({ id: 'b', jobId: 'j1', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.firstTakenOn).toBe('2026-04-01');
    expect(r.rows[0]?.lastTakenOn).toBe('2026-04-15');
  });

  it('computes avg days between and max gap', () => {
    const r = buildPhotoCadenceByJob({
      asOf: '2026-04-30',
      photos: [
        ph({ id: 'a', takenOn: '2026-04-01' }),
        ph({ id: 'b', takenOn: '2026-04-04' }),  // 3 day gap
        ph({ id: 'c', takenOn: '2026-04-15' }),  // 11 day gap
      ],
    });
    expect(r.rows[0]?.avgDaysBetween).toBe(7);
    expect(r.rows[0]?.maxGapDays).toBe(11);
  });

  it('computes days since last vs asOf', () => {
    const r = buildPhotoCadenceByJob({
      asOf: '2026-04-30',
      photos: [ph({ takenOn: '2026-04-15' })],
    });
    expect(r.rows[0]?.daysSinceLast).toBe(15);
  });

  it('handles single-photo jobs (no gaps)', () => {
    const r = buildPhotoCadenceByJob({
      asOf: '2026-04-30',
      photos: [ph({ takenOn: '2026-04-15' })],
    });
    expect(r.rows[0]?.avgDaysBetween).toBe(0);
    expect(r.rows[0]?.maxGapDays).toBe(0);
  });

  it('sorts by maxGapDays desc', () => {
    const r = buildPhotoCadenceByJob({
      asOf: '2026-04-30',
      photos: [
        ph({ id: 'a1', jobId: 'small', takenOn: '2026-04-01' }),
        ph({ id: 'a2', jobId: 'small', takenOn: '2026-04-03' }),
        ph({ id: 'b1', jobId: 'big-gap', takenOn: '2026-04-01' }),
        ph({ id: 'b2', jobId: 'big-gap', takenOn: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big-gap');
  });

  it('handles empty input', () => {
    const r = buildPhotoCadenceByJob({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
