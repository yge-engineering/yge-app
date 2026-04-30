import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { ToolboxTalk } from './toolbox-talk';

import { buildCustomerToolboxDetailSnapshot } from './customer-toolbox-detail-snapshot';

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

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tb-1',
    createdAt: '',
    updatedAt: '',
    heldOn: '2026-04-15',
    jobId: 'j1',
    topic: 'Heat',
    leaderName: 'Pat',
    attendees: [
      { name: 'A', signed: true },
      { name: 'B', signed: false },
    ],
    ...over,
  } as ToolboxTalk;
}

describe('buildCustomerToolboxDetailSnapshot', () => {
  it('returns one row per job sorted by talks', () => {
    const r = buildCustomerToolboxDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      toolboxTalks: [
        tb({ id: 'a', jobId: 'j1' }),
        tb({ id: 'b', jobId: 'j1', heldOn: '2026-04-22' }),
        tb({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.talks).toBe(2);
    expect(r.rows[0]?.lastTalkDate).toBe('2026-04-22');
  });

  it('handles unknown customer', () => {
    const r = buildCustomerToolboxDetailSnapshot({ customerName: 'X', jobs: [], toolboxTalks: [] });
    expect(r.rows.length).toBe(0);
  });
});
