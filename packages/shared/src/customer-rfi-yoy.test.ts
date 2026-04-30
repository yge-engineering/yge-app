import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Rfi } from './rfi';

import { buildCustomerRfiYoy } from './customer-rfi-yoy';

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

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-01T00:00:00Z',
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

describe('buildCustomerRfiYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerRfiYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Other')],
      rfis: [
        rfi({ id: 'a', sentAt: '2025-04-01T00:00:00Z' }),
        rfi({ id: 'b', sentAt: '2026-04-01T00:00:00Z' }),
        rfi({ id: 'c', jobId: 'j2', sentAt: '2026-04-01T00:00:00Z' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
  });

  it('counts answered + cost/schedule impact', () => {
    const r = buildCustomerRfiYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      rfis: [
        rfi({ id: 'a', status: 'ANSWERED', costImpact: true }),
        rfi({ id: 'b', status: 'SENT', scheduleImpact: true }),
      ],
    });
    expect(r.currentAnswered).toBe(1);
    expect(r.currentCostImpact).toBe(1);
    expect(r.currentScheduleImpact).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerRfiYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      rfis: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
