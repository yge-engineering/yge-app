import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPhotoEvidenceByJobMonthly } from './photo-evidence-by-job-monthly';

function ph(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Sta',
    caption: 'Test',
    category: 'DELAY',
    reference: 'IMG.jpg',
    ...over,
  } as Photo;
}

describe('buildPhotoEvidenceByJobMonthly', () => {
  it('only counts evidence categories', () => {
    const r = buildPhotoEvidenceByJobMonthly({
      photos: [
        ph({ id: 'd', category: 'DELAY' }),
        ph({ id: 'co', category: 'CHANGE_ORDER' }),
        ph({ id: 'i', category: 'INCIDENT' }),
        ph({ id: 'p', category: 'PUNCH' }),
        ph({ id: 'pr', category: 'PROGRESS' }), // skipped
      ],
    });
    expect(r.rollup.totalEvidence).toBe(4);
  });

  it('breaks down by category', () => {
    const r = buildPhotoEvidenceByJobMonthly({
      photos: [
        ph({ id: 'a', category: 'DELAY' }),
        ph({ id: 'b', category: 'DELAY' }),
        ph({ id: 'c', category: 'CHANGE_ORDER' }),
        ph({ id: 'd', category: 'INCIDENT' }),
        ph({ id: 'e', category: 'PUNCH' }),
      ],
    });
    expect(r.rows[0]?.delayCount).toBe(2);
    expect(r.rows[0]?.changeOrderCount).toBe(1);
    expect(r.rows[0]?.incidentCount).toBe(1);
    expect(r.rows[0]?.punchCount).toBe(1);
  });

  it('groups by (job, month)', () => {
    const r = buildPhotoEvidenceByJobMonthly({
      photos: [
        ph({ id: 'a', jobId: 'j1', takenOn: '2026-03-15' }),
        ph({ id: 'b', jobId: 'j1', takenOn: '2026-04-15' }),
        ph({ id: 'c', jobId: 'j2', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts distinct days', () => {
    const r = buildPhotoEvidenceByJobMonthly({
      photos: [
        ph({ id: 'a', takenOn: '2026-04-15' }),
        ph({ id: 'b', takenOn: '2026-04-16' }),
        ph({ id: 'c', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.distinctDays).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPhotoEvidenceByJobMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      photos: [
        ph({ id: 'mar', takenOn: '2026-03-15' }),
        ph({ id: 'apr', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalEvidence).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildPhotoEvidenceByJobMonthly({
      photos: [
        ph({ id: 'a', jobId: 'Z', takenOn: '2026-04-15' }),
        ph({ id: 'b', jobId: 'A', takenOn: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildPhotoEvidenceByJobMonthly({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
