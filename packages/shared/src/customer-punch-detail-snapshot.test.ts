import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { PunchItem } from './punch-list';

import { buildCustomerPunchDetailSnapshot } from './customer-punch-detail-snapshot';

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

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    location: 'Sta. 12+50',
    description: 'X',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildCustomerPunchDetailSnapshot', () => {
  it('returns one row per job sorted by open', () => {
    const r = buildCustomerPunchDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      punchItems: [
        pi({ id: 'a', jobId: 'j1', status: 'OPEN', severity: 'SAFETY', dueOn: '2026-04-20' }),
        pi({ id: 'b', jobId: 'j1', status: 'IN_PROGRESS', severity: 'MAJOR', dueOn: '2026-04-29' }),
        pi({ id: 'c', jobId: 'j1', status: 'CLOSED', severity: 'MINOR' }),
        pi({ id: 'd', jobId: 'j2', status: 'OPEN', severity: 'MINOR', dueOn: '2026-05-15' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(3);
    expect(r.rows[0]?.open).toBe(2);
    expect(r.rows[0]?.closed).toBe(1);
    expect(r.rows[0]?.safety).toBe(1);
    expect(r.rows[0]?.major).toBe(1);
    expect(r.rows[0]?.minor).toBe(1);
    // a is overdue (20 < 30), b is not (29 < 30 also overdue!) — both overdue
    expect(r.rows[0]?.overdue).toBe(2);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.open).toBe(1);
    expect(r.rows[1]?.overdue).toBe(0);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPunchDetailSnapshot({
      customerName: 'X',
      jobs: [],
      punchItems: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
