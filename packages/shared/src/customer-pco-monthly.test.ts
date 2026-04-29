import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Pco } from './pco';

import { buildCustomerPcoMonthly } from './customer-pco-monthly';

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

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'p-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    pcoNumber: '1',
    title: 'Test',
    description: 'Test',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-15',
    costImpactCents: 50_000_00,
    scheduleImpactDays: 5,
    ...over,
  } as Pco;
}

describe('buildCustomerPcoMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerPcoMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      pcos: [
        pco({ id: 'a', jobId: 'j1', noticedOn: '2026-04-15' }),
        pco({ id: 'b', jobId: 'j2', noticedOn: '2026-04-15' }),
        pco({ id: 'c', jobId: 'j1', noticedOn: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts open vs converted', () => {
    const r = buildCustomerPcoMonthly({
      jobs: [job({ id: 'j1' })],
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED' }),
        pco({ id: 'b', status: 'CONVERTED_TO_CO' }),
        pco({ id: 'c', status: 'REJECTED' }),
      ],
    });
    expect(r.rows[0]?.openCount).toBe(1);
    expect(r.rows[0]?.convertedCount).toBe(1);
  });

  it('sums total cost impact + open cost exposure (positive only)', () => {
    const r = buildCustomerPcoMonthly({
      jobs: [job({ id: 'j1' })],
      pcos: [
        pco({ id: 'open-pos', status: 'SUBMITTED', costImpactCents: 50_000_00 }),
        pco({ id: 'open-neg', status: 'SUBMITTED', costImpactCents: -10_000_00 }),
        pco({ id: 'closed', status: 'CONVERTED_TO_CO', costImpactCents: 99_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCostImpactCents).toBe(50_000_00 + -10_000_00 + 99_000_00);
    expect(r.rows[0]?.openCostImpactCents).toBe(50_000_00);
  });

  it('sums schedule impact days', () => {
    const r = buildCustomerPcoMonthly({
      jobs: [job({ id: 'j1' })],
      pcos: [
        pco({ id: 'a', scheduleImpactDays: 5 }),
        pco({ id: 'b', scheduleImpactDays: 10 }),
      ],
    });
    expect(r.rows[0]?.totalScheduleImpactDays).toBe(15);
  });

  it('counts unattributed (no matching job)', () => {
    const r = buildCustomerPcoMonthly({
      jobs: [job({ id: 'j1', ownerAgency: 'Caltrans D2' })],
      pcos: [
        pco({ id: 'a', jobId: 'j1' }),
        pco({ id: 'b', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerPcoMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      pcos: [
        pco({ id: 'old', noticedOn: '2026-03-15' }),
        pco({ id: 'in', noticedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPcos).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerPcoMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      pcos: [
        pco({ id: 'a', jobId: 'jZ', noticedOn: '2026-04-15' }),
        pco({ id: 'b', jobId: 'jA', noticedOn: '2026-05-01' }),
        pco({ id: 'c', jobId: 'jA', noticedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerPcoMonthly({ jobs: [], pcos: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalPcos).toBe(0);
  });
});
