import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildEmployeeToolboxByJob } from './employee-toolbox-by-job';

function tbt(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    heldOn: '2026-04-15',
    jobId: 'j1',
    topic: 'PPE',
    leaderName: 'Brook',
    attendees: [{ employeeId: 'e1', name: 'Joe', signed: true }],
    status: 'SUBMITTED',
    ...over,
  } as ToolboxTalk;
}

describe('buildEmployeeToolboxByJob', () => {
  it('groups by (employee, job)', () => {
    const r = buildEmployeeToolboxByJob({
      toolboxTalks: [
        tbt({ id: 'a', jobId: 'j1', attendees: [{ employeeId: 'e1', name: 'Joe', signed: true }] }),
        tbt({ id: 'b', jobId: 'j2', attendees: [{ employeeId: 'e1', name: 'Joe', signed: true }] }),
        tbt({ id: 'c', jobId: 'j1', attendees: [{ employeeId: 'e2', name: 'Mary', signed: true }] }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts attended + signed', () => {
    const r = buildEmployeeToolboxByJob({
      toolboxTalks: [
        tbt({ id: 'a', attendees: [{ employeeId: 'e1', name: 'Joe', signed: true }] }),
        tbt({ id: 'b', heldOn: '2026-04-20', attendees: [{ employeeId: 'e1', name: 'Joe', signed: false }] }),
      ],
    });
    expect(r.rows[0]?.talksAttended).toBe(2);
    expect(r.rows[0]?.signedCount).toBe(1);
  });

  it('counts distinct topics', () => {
    const r = buildEmployeeToolboxByJob({
      toolboxTalks: [
        tbt({ id: 'a', topic: 'PPE' }),
        tbt({ id: 'b', topic: 'Trenching' }),
        tbt({ id: 'c', topic: 'PPE' }),
      ],
    });
    expect(r.rows[0]?.distinctTopics).toBe(2);
  });

  it('skips talks with no jobId or attendees with no employeeId', () => {
    const r = buildEmployeeToolboxByJob({
      toolboxTalks: [
        tbt({ id: 'nojobid', jobId: undefined }),
        tbt({ id: 'visitor', attendees: [{ name: 'Stranger', signed: false }] }),
        tbt({ id: 'good' }),
      ],
    });
    expect(r.rollup.totalAttendances).toBe(1);
  });

  it('tracks lastHeldOn', () => {
    const r = buildEmployeeToolboxByJob({
      toolboxTalks: [
        tbt({ id: 'a', heldOn: '2026-04-10' }),
        tbt({ id: 'b', heldOn: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.lastHeldOn).toBe('2026-04-20');
  });

  it('respects fromDate / toDate', () => {
    const r = buildEmployeeToolboxByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      toolboxTalks: [
        tbt({ id: 'old', heldOn: '2026-03-15' }),
        tbt({ id: 'in', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalAttendances).toBe(1);
  });

  it('sorts by employeeId asc, attended desc within employee', () => {
    const r = buildEmployeeToolboxByJob({
      toolboxTalks: [
        tbt({ id: 'a', jobId: 'small', attendees: [{ employeeId: 'A', name: 'X', signed: true }] }),
        tbt({ id: 'b1', jobId: 'big', attendees: [{ employeeId: 'A', name: 'X', signed: true }] }),
        tbt({ id: 'b2', jobId: 'big', attendees: [{ employeeId: 'A', name: 'X', signed: true }] }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildEmployeeToolboxByJob({ toolboxTalks: [] });
    expect(r.rows).toHaveLength(0);
  });
});
