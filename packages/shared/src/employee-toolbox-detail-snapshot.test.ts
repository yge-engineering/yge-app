import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildEmployeeToolboxDetailSnapshot } from './employee-toolbox-detail-snapshot';

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '',
    updatedAt: '',
    heldOn: '2026-04-13',
    topic: 'Trenching',
    leaderName: 'Mike',
    attendees: [],
    status: 'HELD',
    jobId: 'j1',
    ...over,
  } as ToolboxTalk;
}

describe('buildEmployeeToolboxDetailSnapshot', () => {
  it('returns one row per job sorted by attended', () => {
    const r = buildEmployeeToolboxDetailSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      toolboxTalks: [
        tb({ id: 'a', jobId: 'j1', heldOn: '2026-04-13', topic: 'Trenching', attendees: [{ employeeId: 'e1', name: 'Pat', signed: true }] }),
        tb({ id: 'b', jobId: 'j1', heldOn: '2026-04-20', topic: 'Heat', attendees: [{ employeeId: 'e1', name: 'Pat', signed: false }] }),
        tb({ id: 'c', jobId: 'j2', heldOn: '2026-04-15', topic: 'Trenching', attendees: [{ employeeId: 'e1', name: 'Pat', signed: true }] }),
        tb({ id: 'd', jobId: 'j1', heldOn: '2026-04-22', topic: 'Lockout', attendees: [{ employeeId: 'e2', name: 'Sam', signed: true }] }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.attended).toBe(2);
    expect(r.rows[0]?.signed).toBe(1);
    expect(r.rows[0]?.distinctTopics).toBe(2);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.attended).toBe(1);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeToolboxDetailSnapshot({ employeeId: 'X', toolboxTalks: [] });
    expect(r.rows.length).toBe(0);
  });
});
