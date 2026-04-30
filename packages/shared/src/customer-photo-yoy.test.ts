import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Photo } from './photo';

import { buildCustomerPhotoYoy } from './customer-photo-yoy';

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

describe('buildCustomerPhotoYoy', () => {
  it('compares prior vs current year for one customer', () => {
    const r = buildCustomerPhotoYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Other')],
      photos: [
        photo({ id: 'a', jobId: 'j1', takenOn: '2025-04-15' }),
        photo({ id: 'b', jobId: 'j1', takenOn: '2025-08-15' }),
        photo({ id: 'c', jobId: 'j1', takenOn: '2026-04-15' }),
        photo({ id: 'd', jobId: 'j2', takenOn: '2026-04-15' }), // not customer
      ],
    });
    expect(r.priorTotal).toBe(2);
    expect(r.currentTotal).toBe(1);
    expect(r.totalDelta).toBe(-1);
  });

  it('counts category + distinct jobs + photographers per year', () => {
    const r = buildCustomerPhotoYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      photos: [
        photo({ id: 'a', jobId: 'j1', takenOn: '2026-04-15', category: 'PROGRESS', photographerName: 'Pat' }),
        photo({ id: 'b', jobId: 'j2', takenOn: '2026-04-15', category: 'DELAY', photographerName: 'Sam' }),
      ],
    });
    expect(r.currentByCategory.PROGRESS).toBe(1);
    expect(r.currentByCategory.DELAY).toBe(1);
    expect(r.currentDistinctJobs).toBe(2);
    expect(r.currentDistinctPhotographers).toBe(2);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPhotoYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      photos: [],
    });
    expect(r.priorTotal).toBe(0);
    expect(r.currentTotal).toBe(0);
  });
});
