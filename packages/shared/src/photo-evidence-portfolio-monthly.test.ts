import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildPhotoEvidencePortfolioMonthly } from './photo-evidence-portfolio-monthly';

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

describe('buildPhotoEvidencePortfolioMonthly', () => {
  it('only counts evidence categories', () => {
    const r = buildPhotoEvidencePortfolioMonthly({
      photos: [
        ph({ id: 'd', category: 'DELAY' }),
        ph({ id: 'co', category: 'CHANGE_ORDER' }),
        ph({ id: 'i', category: 'INCIDENT' }),
        ph({ id: 'p', category: 'PUNCH' }),
        ph({ id: 'pr', category: 'PROGRESS' }),
      ],
    });
    expect(r.rollup.totalEvidence).toBe(4);
  });

  it('breaks down by evidence category', () => {
    const r = buildPhotoEvidencePortfolioMonthly({
      photos: [
        ph({ id: 'a', category: 'DELAY' }),
        ph({ id: 'b', category: 'DELAY' }),
        ph({ id: 'c', category: 'INCIDENT' }),
      ],
    });
    expect(r.rows[0]?.delayCount).toBe(2);
    expect(r.rows[0]?.incidentCount).toBe(1);
  });

  it('groups by month + counts distinct jobs', () => {
    const r = buildPhotoEvidencePortfolioMonthly({
      photos: [
        ph({ id: 'a', jobId: 'j1', takenOn: '2026-04-15' }),
        ph({ id: 'b', jobId: 'j2', takenOn: '2026-04-15' }),
        ph({ id: 'c', jobId: 'j1', takenOn: '2026-03-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const apr = r.rows.find((x) => x.month === '2026-04');
    expect(apr?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPhotoEvidencePortfolioMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      photos: [
        ph({ id: 'mar', takenOn: '2026-03-15' }),
        ph({ id: 'apr', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalEvidence).toBe(1);
  });

  it('computes month-over-month change', () => {
    const r = buildPhotoEvidencePortfolioMonthly({
      photos: [
        ph({ id: 'mar', takenOn: '2026-03-15' }),
        ph({ id: 'apr1', takenOn: '2026-04-10' }),
        ph({ id: 'apr2', takenOn: '2026-04-20' }),
      ],
    });
    expect(r.rollup.monthOverMonthChange).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPhotoEvidencePortfolioMonthly({
      photos: [
        ph({ id: 'late', takenOn: '2026-04-15' }),
        ph({ id: 'early', takenOn: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildPhotoEvidencePortfolioMonthly({ photos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
