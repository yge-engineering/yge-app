import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { ToolboxTalk } from './toolbox-talk';

import { buildCustomerToolboxMonthly } from './customer-toolbox-monthly';

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

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tb-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
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

describe('buildCustomerToolboxMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerToolboxMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      toolboxTalks: [
        tb({ id: 'a', jobId: 'j1', heldOn: '2026-04-15' }),
        tb({ id: 'b', jobId: 'j2', heldOn: '2026-04-15' }),
        tb({ id: 'c', jobId: 'j1', heldOn: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts distinct topics + leaders', () => {
    const r = buildCustomerToolboxMonthly({
      jobs: [job({ id: 'j1' })],
      toolboxTalks: [
        tb({ id: 'a', topic: 'Heat illness', leaderName: 'Pat' }),
        tb({ id: 'b', topic: 'Trenching', leaderName: 'Pat' }),
        tb({ id: 'c', topic: 'Heat illness', leaderName: 'Sam' }),
      ],
    });
    expect(r.rows[0]?.distinctTopics).toBe(2);
    expect(r.rows[0]?.distinctLeaders).toBe(2);
  });

  it('sums attendee + signed counts', () => {
    const r = buildCustomerToolboxMonthly({
      jobs: [job({ id: 'j1' })],
      toolboxTalks: [
        tb({
          id: 'a',
          attendees: [
            { name: 'A', signed: true },
            { name: 'B', signed: true },
            { name: 'C', signed: false },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalAttendees).toBe(3);
    expect(r.rows[0]?.signedAttendees).toBe(2);
  });

  it('counts unattributed (no jobId or no matching job)', () => {
    const r = buildCustomerToolboxMonthly({
      jobs: [job({ id: 'j1' })],
      toolboxTalks: [
        tb({ id: 'a', jobId: 'j1' }),
        tb({ id: 'b', jobId: undefined }),
        tb({ id: 'c', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerToolboxMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      toolboxTalks: [
        tb({ id: 'old', heldOn: '2026-03-15' }),
        tb({ id: 'in', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalTalks).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerToolboxMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      toolboxTalks: [
        tb({ id: 'a', jobId: 'jZ', heldOn: '2026-04-15' }),
        tb({ id: 'b', jobId: 'jA', heldOn: '2026-05-01' }),
        tb({ id: 'c', jobId: 'jA', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerToolboxMonthly({ jobs: [], toolboxTalks: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalTalks).toBe(0);
  });
});
