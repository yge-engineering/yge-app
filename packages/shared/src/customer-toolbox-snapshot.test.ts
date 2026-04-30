import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { ToolboxTalk } from './toolbox-talk';

import { buildCustomerToolboxSnapshot } from './customer-toolbox-snapshot';

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

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tb-1',
    createdAt: '',
    updatedAt: '',
    heldOn: '2026-04-15',
    jobId: 'j1',
    topic: 'Heat illness',
    leaderName: 'Pat',
    attendees: [
      { name: 'A', signed: true },
      { name: 'B', signed: false },
    ],
    ...over,
  } as ToolboxTalk;
}

describe('buildCustomerToolboxSnapshot', () => {
  it('joins talks to a customer via job.ownerAgency', () => {
    const r = buildCustomerToolboxSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      toolboxTalks: [tb({ id: 'a', jobId: 'j1' }), tb({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalTalks).toBe(1);
  });

  it('counts attendees + last talk date', () => {
    const r = buildCustomerToolboxSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      toolboxTalks: [
        tb({
          id: 'a',
          heldOn: '2026-04-08',
          attendees: [
            { name: 'A', signed: true },
            { name: 'B', signed: true },
            { name: 'C', signed: false },
          ],
        }),
        tb({ id: 'b', heldOn: '2026-04-22' }),
      ],
    });
    expect(r.totalAttendees).toBe(5);
    expect(r.signedAttendees).toBe(3);
    expect(r.lastTalkDate).toBe('2026-04-22');
  });

  it('handles unknown customer', () => {
    const r = buildCustomerToolboxSnapshot({ customerName: 'X', jobs: [], toolboxTalks: [] });
    expect(r.totalTalks).toBe(0);
  });
});
