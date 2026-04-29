import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Submittal } from './submittal';

import { buildCustomerSubmittalMonthly } from './customer-submittal-monthly';

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

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sb-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    submittalNumber: '001',
    subject: 'Test',
    kind: 'PRODUCT_DATA',
    status: 'APPROVED',
    submittedAt: '2026-04-15',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildCustomerSubmittalMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerSubmittalMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      submittals: [
        sub({ id: 'a', jobId: 'j1', submittedAt: '2026-04-15' }),
        sub({ id: 'b', jobId: 'j2', submittedAt: '2026-04-15' }),
        sub({ id: 'c', jobId: 'j1', submittedAt: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts by status', () => {
    const r = buildCustomerSubmittalMonthly({
      jobs: [job({ id: 'j1' })],
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
        sub({ id: 'b', status: 'APPROVED_AS_NOTED' }),
        sub({ id: 'c', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'd', status: 'REJECTED' }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(2);
    expect(r.rows[0]?.reviseResubmitCount).toBe(1);
    expect(r.rows[0]?.rejectedCount).toBe(1);
  });

  it('counts blocksOrdering', () => {
    const r = buildCustomerSubmittalMonthly({
      jobs: [job({ id: 'j1' })],
      submittals: [
        sub({ id: 'a', blocksOrdering: true }),
        sub({ id: 'b', blocksOrdering: false }),
      ],
    });
    expect(r.rows[0]?.blockedOrderingCount).toBe(1);
  });

  it('skips submittals with no submittedAt', () => {
    const r = buildCustomerSubmittalMonthly({
      jobs: [job({ id: 'j1' })],
      submittals: [
        sub({ id: 'a', submittedAt: undefined }),
        sub({ id: 'b' }),
      ],
    });
    expect(r.rollup.noSubmittedAtSkipped).toBe(1);
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('counts unattributed (no matching job)', () => {
    const r = buildCustomerSubmittalMonthly({
      jobs: [job({ id: 'j1', ownerAgency: 'Caltrans D2' })],
      submittals: [
        sub({ id: 'a', jobId: 'j1' }),
        sub({ id: 'b', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerSubmittalMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      submittals: [
        sub({ id: 'old', submittedAt: '2026-03-15' }),
        sub({ id: 'in', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerSubmittalMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      submittals: [
        sub({ id: 'a', jobId: 'jZ', submittedAt: '2026-04-15' }),
        sub({ id: 'b', jobId: 'jA', submittedAt: '2026-05-01' }),
        sub({ id: 'c', jobId: 'jA', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerSubmittalMonthly({ jobs: [], submittals: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalSubmittals).toBe(0);
  });
});
