import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Rfi } from './rfi';

import { buildCustomerRfiMonthly } from './customer-rfi-monthly';

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

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'r-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    rfiNumber: '1',
    subject: 'Test',
    status: 'SENT',
    priority: 'MEDIUM',
    sentAt: '2026-04-15',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildCustomerRfiMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerRfiMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      rfis: [
        rfi({ id: 'a', jobId: 'j1', sentAt: '2026-04-15' }),
        rfi({ id: 'b', jobId: 'j2', sentAt: '2026-04-15' }),
        rfi({ id: 'c', jobId: 'j1', sentAt: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts answered RFIs', () => {
    const r = buildCustomerRfiMonthly({
      jobs: [job({ id: 'j1' })],
      rfis: [
        rfi({ id: 'a', answeredAt: '2026-04-20' }),
        rfi({ id: 'b' }),
      ],
    });
    expect(r.rows[0]?.answeredCount).toBe(1);
  });

  it('breaks down by priority', () => {
    const r = buildCustomerRfiMonthly({
      jobs: [job({ id: 'j1' })],
      rfis: [
        rfi({ id: 'a', priority: 'HIGH' }),
        rfi({ id: 'b', priority: 'CRITICAL' }),
        rfi({ id: 'c', priority: 'HIGH' }),
      ],
    });
    expect(r.rows[0]?.byPriority.HIGH).toBe(2);
    expect(r.rows[0]?.byPriority.CRITICAL).toBe(1);
  });

  it('counts cost + schedule impact flags', () => {
    const r = buildCustomerRfiMonthly({
      jobs: [job({ id: 'j1' })],
      rfis: [
        rfi({ id: 'a', costImpact: true }),
        rfi({ id: 'b', scheduleImpact: true }),
        rfi({ id: 'c', costImpact: true, scheduleImpact: true }),
      ],
    });
    expect(r.rows[0]?.costImpactCount).toBe(2);
    expect(r.rows[0]?.scheduleImpactCount).toBe(2);
  });

  it('skips RFIs with no sentAt', () => {
    const r = buildCustomerRfiMonthly({
      jobs: [job({ id: 'j1' })],
      rfis: [
        rfi({ id: 'a', sentAt: undefined }),
        rfi({ id: 'b' }),
      ],
    });
    expect(r.rollup.noSentAtSkipped).toBe(1);
    expect(r.rollup.totalRfis).toBe(1);
  });

  it('counts unattributed (no matching job)', () => {
    const r = buildCustomerRfiMonthly({
      jobs: [job({ id: 'j1', ownerAgency: 'Caltrans D2' })],
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerRfiMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      rfis: [
        rfi({ id: 'old', sentAt: '2026-03-15' }),
        rfi({ id: 'in', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalRfis).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerRfiMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      rfis: [
        rfi({ id: 'a', jobId: 'jZ', sentAt: '2026-04-15' }),
        rfi({ id: 'b', jobId: 'jA', sentAt: '2026-05-01' }),
        rfi({ id: 'c', jobId: 'jA', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerRfiMonthly({ jobs: [], rfis: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalRfis).toBe(0);
  });
});
