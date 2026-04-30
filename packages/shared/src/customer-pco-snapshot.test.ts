import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Pco } from './pco';

import { buildCustomerPcoSnapshot } from './customer-pco-snapshot';

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

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'p-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    pcoNumber: '1',
    title: 'T',
    description: 'T',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-15',
    costImpactCents: 50_000_00,
    scheduleImpactDays: 5,
    ...over,
  } as Pco;
}

describe('buildCustomerPcoSnapshot', () => {
  it('joins PCOs to a customer via job.ownerAgency', () => {
    const r = buildCustomerPcoSnapshot({
      customerName: 'Caltrans',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      pcos: [pco({ id: 'a', jobId: 'j1' }), pco({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalPcos).toBe(1);
  });

  it('counts open vs converted', () => {
    const r = buildCustomerPcoSnapshot({
      customerName: 'Caltrans',
      jobs: [jb({ id: 'j1' })],
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED' }),
        pco({ id: 'b', status: 'CONVERTED_TO_CO' }),
        pco({ id: 'c', status: 'WITHDRAWN' }),
      ],
    });
    expect(r.openCount).toBe(1);
    expect(r.convertedCount).toBe(1);
  });

  it('sums open cost exposure (positive only, open only)', () => {
    const r = buildCustomerPcoSnapshot({
      customerName: 'Caltrans',
      jobs: [jb({ id: 'j1' })],
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED', costImpactCents: 50_000_00 }),
        pco({ id: 'b', status: 'CONVERTED_TO_CO', costImpactCents: 99_000_00 }),
      ],
    });
    expect(r.openCostImpactCents).toBe(50_000_00);
    expect(r.totalCostImpactCents).toBe(149_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPcoSnapshot({ customerName: 'X', jobs: [], pcos: [] });
    expect(r.totalPcos).toBe(0);
  });
});
