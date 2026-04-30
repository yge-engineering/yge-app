import { describe, expect, it } from 'vitest';

import type { Photo } from './photo';

import { buildEmployeePhotoDetailSnapshot } from './employee-photo-detail-snapshot';

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

describe('buildEmployeePhotoDetailSnapshot', () => {
  it('returns one row per job sorted by total', () => {
    const r = buildEmployeePhotoDetailSnapshot({
      employeeName: 'Pat',
      asOf: '2026-04-30',
      photos: [
        ph({ id: 'a', jobId: 'j1', photographerName: 'Pat', category: 'PROGRESS' }),
        ph({ id: 'b', jobId: 'j1', photographerName: 'Pat', category: 'INCIDENT' }),
        ph({ id: 'c', jobId: 'j1', photographerName: 'PAT', category: 'PROGRESS' }),
        ph({ id: 'd', jobId: 'j2', photographerName: 'Pat', category: 'PUNCH' }),
        ph({ id: 'e', jobId: 'j1', photographerName: 'Sam', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(3);
    expect(r.rows[0]?.progress).toBe(2);
    expect(r.rows[0]?.incident).toBe(1);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.punch).toBe(1);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeePhotoDetailSnapshot({ employeeName: 'X', photos: [] });
    expect(r.rows.length).toBe(0);
  });
});
