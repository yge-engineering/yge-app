import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { PunchItem } from './punch-list';

import { buildCustomerPunchSnapshot } from './customer-punch-snapshot';

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

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    location: 'Bay 1',
    description: 'Test',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildCustomerPunchSnapshot', () => {
  it('joins items to a customer via job.ownerAgency', () => {
    const r = buildCustomerPunchSnapshot({
      customerName: 'Caltrans',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      punchItems: [pi({ id: 'a', jobId: 'j1' }), pi({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalItems).toBe(1);
  });

  it('counts open vs closed', () => {
    const r = buildCustomerPunchSnapshot({
      customerName: 'Caltrans',
      jobs: [jb({ id: 'j1' })],
      punchItems: [
        pi({ id: 'a', status: 'OPEN' }),
        pi({ id: 'b', status: 'IN_PROGRESS' }),
        pi({ id: 'c', status: 'CLOSED' }),
        pi({ id: 'd', status: 'WAIVED' }),
      ],
    });
    expect(r.openCount).toBe(2);
    expect(r.closedCount).toBe(2);
  });

  it('breaks open by severity + tracks oldest age', () => {
    const r = buildCustomerPunchSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-06-30',
      jobs: [jb({ id: 'j1' })],
      punchItems: [
        pi({ id: 'a', status: 'OPEN', severity: 'SAFETY', identifiedOn: '2026-04-25' }),
        pi({ id: 'b', status: 'OPEN', severity: 'MAJOR', identifiedOn: '2026-06-25' }),
      ],
    });
    expect(r.openBySeverity.SAFETY).toBe(1);
    expect(r.openBySeverity.MAJOR).toBe(1);
    expect(r.oldestOpenAgeDays ?? 0).toBeGreaterThan(60);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPunchSnapshot({ customerName: 'X', jobs: [], punchItems: [] });
    expect(r.totalItems).toBe(0);
  });
});
