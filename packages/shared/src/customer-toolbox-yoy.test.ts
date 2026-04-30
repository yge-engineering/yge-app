import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { ToolboxTalk } from './toolbox-talk';

import { buildCustomerToolboxYoy } from './customer-toolbox-yoy';

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

describe('buildCustomerToolboxYoy', () => {
  it('compares prior vs current year for one customer', () => {
    const r = buildCustomerToolboxYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Other')],
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2025-04-15' }),
        tb({ id: 'b', heldOn: '2025-08-15' }),
        tb({ id: 'c', heldOn: '2026-04-15' }),
        tb({ id: 'd', heldOn: '2026-04-15', jobId: 'j2' }),
      ],
    });
    expect(r.priorTotal).toBe(2);
    expect(r.currentTotal).toBe(1);
    expect(r.totalDelta).toBe(-1);
  });

  it('counts attendees per year', () => {
    const r = buildCustomerToolboxYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      toolboxTalks: [
        tb({
          id: 'a',
          heldOn: '2026-04-15',
          attendees: [
            { name: 'A', signed: true },
            { name: 'B', signed: true },
            { name: 'C', signed: false },
          ],
        }),
      ],
    });
    expect(r.currentTotalAttendees).toBe(3);
    expect(r.currentSignedAttendees).toBe(2);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerToolboxYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      toolboxTalks: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
