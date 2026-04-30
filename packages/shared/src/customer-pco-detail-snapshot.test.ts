import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Pco } from './pco';

import { buildCustomerPcoDetailSnapshot } from './customer-pco-detail-snapshot';

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

function pc(over: Partial<Pco>): Pco {
  return {
    id: 'pco-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    pcoNumber: 'PCO-001',
    title: 'X',
    description: '',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-10',
    submittedOn: '2026-04-12',
    costImpactCents: 50_000_00,
    scheduleImpactDays: 5,
    ...over,
  } as Pco;
}

describe('buildCustomerPcoDetailSnapshot', () => {
  it('returns one row per job sorted by open exposure', () => {
    const r = buildCustomerPcoDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      pcos: [
        pc({ id: 'a', jobId: 'j1', status: 'SUBMITTED', costImpactCents: 100_000_00, scheduleImpactDays: 10 }),
        pc({ id: 'b', jobId: 'j1', status: 'CONVERTED_TO_CO', costImpactCents: 25_000_00 }),
        pc({ id: 'c', jobId: 'j2', status: 'APPROVED_PENDING_CO', costImpactCents: 40_000_00, scheduleImpactDays: 2 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.open).toBe(1);
    expect(r.rows[0]?.convertedToCo).toBe(1);
    expect(r.rows[0]?.openCostCents).toBe(100_000_00);
    expect(r.rows[0]?.openScheduleDays).toBe(10);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.approvedPendingCo).toBe(1);
    expect(r.rows[1]?.openCostCents).toBe(40_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPcoDetailSnapshot({
      customerName: 'X',
      jobs: [],
      pcos: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
