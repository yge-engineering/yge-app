import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Rfi } from './rfi';

import { buildCustomerRfiSnapshot } from './customer-rfi-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
  } as Job;
}

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    number: 1,
    subject: 'T',
    question: 'Q',
    status: 'SENT',
    priority: 'MEDIUM',
    sentAt: '2026-04-01T00:00:00Z',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildCustomerRfiSnapshot', () => {
  it('joins RFIs to a customer via job.ownerAgency', () => {
    const r = buildCustomerRfiSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [
        jb({ id: 'j1', ownerAgency: 'Caltrans' }),
        jb({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalRfis).toBe(1);
    expect(r.distinctJobs).toBe(1);
  });

  it('counts open + overdue', () => {
    const r = buildCustomerRfiSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1', ownerAgency: 'Caltrans' })],
      rfis: [
        rfi({ id: 'a', status: 'SENT', responseDueAt: '2026-04-15' }),
        rfi({ id: 'b', status: 'ANSWERED', answeredAt: '2026-04-10T08:00:00Z' }),
      ],
    });
    expect(r.openCount).toBe(1);
    expect(r.overdueCount).toBe(1);
  });

  it('counts cost + schedule impact', () => {
    const r = buildCustomerRfiSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1', ownerAgency: 'Caltrans' })],
      rfis: [
        rfi({ id: 'a', costImpact: true, scheduleImpact: false }),
        rfi({ id: 'b', costImpact: false, scheduleImpact: true }),
      ],
    });
    expect(r.costImpactCount).toBe(1);
    expect(r.scheduleImpactCount).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerRfiSnapshot({
      customerName: 'NonExistent',
      jobs: [],
      rfis: [],
    });
    expect(r.totalRfis).toBe(0);
  });
});
