import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Photo } from './photo';

import { buildCustomerPhotoDetailSnapshot } from './customer-photo-detail-snapshot';

function jb(id: string, owner: string): Job {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: owner,
  } as Job;
}

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

describe('buildCustomerPhotoDetailSnapshot', () => {
  it('returns rows per job sorted by photo count', () => {
    const r = buildCustomerPhotoDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      photos: [
        photo({ id: 'a', jobId: 'j1' }),
        photo({ id: 'b', jobId: 'j1', takenOn: '2026-04-22', photographerName: 'Sam' }),
        photo({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.photos).toBe(2);
    expect(r.rows[0]?.distinctPhotographers).toBe(2);
    expect(r.rows[0]?.lastPhotoDate).toBe('2026-04-22');
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPhotoDetailSnapshot({ customerName: 'X', jobs: [], photos: [] });
    expect(r.rows.length).toBe(0);
  });
});
