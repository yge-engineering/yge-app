import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildJobPhotoDetailSnapshot } from './job-photo-detail-snapshot';

function ph(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Sta. 12+50',
    caption: 'X',
    photographerName: 'Pat',
    category: 'PROGRESS',
    reference: 'IMG_001.jpg',
    ...over,
  } as Photo;
}

describe('buildJobPhotoDetailSnapshot', () => {
  it('returns one row per photographer sorted by total', () => {
    const r = buildJobPhotoDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      photos: [
        ph({ id: 'a', jobId: 'j1', photographerName: 'Pat', category: 'PROGRESS' }),
        ph({ id: 'b', jobId: 'j1', photographerName: 'Pat', category: 'INCIDENT' }),
        ph({ id: 'c', jobId: 'j1', photographerName: 'Pat', category: 'COMPLETION' }),
        ph({ id: 'd', jobId: 'j1', photographerName: 'Sam', category: 'SWPPP' }),
        ph({ id: 'e', jobId: 'j2', photographerName: 'Pat', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.photographerName).toBe('Pat');
    expect(r.rows[0]?.total).toBe(3);
    expect(r.rows[0]?.progress).toBe(1);
    expect(r.rows[0]?.incident).toBe(1);
    expect(r.rows[0]?.completion).toBe(1);
    expect(r.rows[1]?.photographerName).toBe('Sam');
    expect(r.rows[1]?.swppp).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobPhotoDetailSnapshot({ jobId: 'X', photos: [] });
    expect(r.rows.length).toBe(0);
  });
});
