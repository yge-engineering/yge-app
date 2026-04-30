import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Photo } from './photo';

import { buildCustomerPhotoSnapshot } from './customer-photo-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
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
    caption: 'Pour',
    category: 'PROGRESS',
    photographerName: 'Pat',
    reference: 'IMG.jpg',
    ...over,
  } as Photo;
}

describe('buildCustomerPhotoSnapshot', () => {
  it('joins photos to a customer via job.ownerAgency', () => {
    const r = buildCustomerPhotoSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      photos: [photo({ id: 'a', jobId: 'j1' }), photo({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalPhotos).toBe(1);
    expect(r.distinctJobs).toBe(1);
  });

  it('breaks down by category + tracks last date', () => {
    const r = buildCustomerPhotoSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      photos: [
        photo({ id: 'a', category: 'PROGRESS', takenOn: '2026-04-08' }),
        photo({ id: 'b', category: 'DELAY', takenOn: '2026-04-22' }),
      ],
    });
    expect(r.byCategory.PROGRESS).toBe(1);
    expect(r.byCategory.DELAY).toBe(1);
    expect(r.lastPhotoDate).toBe('2026-04-22');
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPhotoSnapshot({ customerName: 'X', jobs: [], photos: [] });
    expect(r.totalPhotos).toBe(0);
  });
});
