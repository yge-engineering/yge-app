import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Pco } from './pco';

import { buildCustomerPcoYoy } from './customer-pco-yoy';

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

describe('buildCustomerPcoYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerPcoYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      pcos: [
        pco({ id: 'a', noticedOn: '2025-04-15', costImpactCents: 30_000_00 }),
        pco({ id: 'b', noticedOn: '2026-04-15', costImpactCents: 50_000_00 }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.priorCostImpactCents).toBe(30_000_00);
    expect(r.currentCostImpactCents).toBe(50_000_00);
    expect(r.costImpactDelta).toBe(20_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPcoYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      pcos: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
