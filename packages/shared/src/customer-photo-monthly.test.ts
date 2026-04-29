import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Photo } from './photo';

import { buildCustomerPhotoMonthly } from './customer-photo-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function photo(over: Partial<Photo>): Photo {
  return {
    id: 'p-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    takenOn: '2026-04-15',
    location: 'Bay 1',
    caption: 'Pour',
    category: 'PROGRESS',
    photographerName: 'Pat',
    reference: 'IMG_001.jpg',
    ...over,
  } as Photo;
}

describe('buildCustomerPhotoMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerPhotoMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      photos: [
        photo({ id: 'a', jobId: 'j1', takenOn: '2026-04-15' }),
        photo({ id: 'b', jobId: 'j2', takenOn: '2026-04-15' }),
        photo({ id: 'c', jobId: 'j1', takenOn: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('breaks down by category', () => {
    const r = buildCustomerPhotoMonthly({
      jobs: [job({ id: 'j1' })],
      photos: [
        photo({ id: 'a', category: 'PROGRESS' }),
        photo({ id: 'b', category: 'DELAY' }),
        photo({ id: 'c', category: 'PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.byCategory.PROGRESS).toBe(2);
    expect(r.rows[0]?.byCategory.DELAY).toBe(1);
  });

  it('counts distinct jobs + photographers', () => {
    const r = buildCustomerPhotoMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans D2' }),
      ],
      photos: [
        photo({ id: 'a', jobId: 'j1', photographerName: 'Pat' }),
        photo({ id: 'b', jobId: 'j2', photographerName: 'Sam' }),
        photo({ id: 'c', jobId: 'j1', photographerName: 'Pat' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctPhotographers).toBe(2);
  });

  it('counts unattributed (no matching job)', () => {
    const r = buildCustomerPhotoMonthly({
      jobs: [job({ id: 'j1', ownerAgency: 'Caltrans D2' })],
      photos: [
        photo({ id: 'a', jobId: 'j1' }),
        photo({ id: 'b', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerPhotoMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      photos: [
        photo({ id: 'old', takenOn: '2026-03-15' }),
        photo({ id: 'in', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPhotos).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerPhotoMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      photos: [
        photo({ id: 'a', jobId: 'jZ', takenOn: '2026-04-15' }),
        photo({ id: 'b', jobId: 'jA', takenOn: '2026-05-01' }),
        photo({ id: 'c', jobId: 'jA', takenOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerPhotoMonthly({ jobs: [], photos: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalPhotos).toBe(0);
  });
});
