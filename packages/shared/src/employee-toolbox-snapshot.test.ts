import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildEmployeeToolboxSnapshot } from './employee-toolbox-snapshot';

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
      { employeeId: 'e1', name: 'Pat', signed: true },
      { name: 'Sam', signed: false },
    ],
    ...over,
  } as ToolboxTalk;
}

describe('buildEmployeeToolboxSnapshot', () => {
  it('counts attendance via employeeId match', () => {
    const r = buildEmployeeToolboxSnapshot({
      employeeId: 'e1',
      employeeName: 'Pat',
      asOf: '2026-04-30',
      toolboxTalks: [tb({ id: 'a' })],
    });
    expect(r.attendedTalks).toBe(1);
    expect(r.signedTalks).toBe(1);
  });

  it('counts attendance via name match when employeeId missing on attendee', () => {
    const r = buildEmployeeToolboxSnapshot({
      employeeId: 'e1',
      employeeName: 'Sam',
      asOf: '2026-04-30',
      toolboxTalks: [
        tb({
          id: 'a',
          attendees: [{ name: 'Sam', signed: true }],
        }),
      ],
    });
    expect(r.attendedTalks).toBe(1);
  });

  it('counts led talks', () => {
    const r = buildEmployeeToolboxSnapshot({
      employeeId: 'e1',
      employeeName: 'Pat',
      asOf: '2026-04-30',
      toolboxTalks: [
        tb({ id: 'a', leaderName: 'Pat', attendees: [] }),
        tb({ id: 'b', leaderName: 'Sam', attendees: [{ employeeId: 'e1', name: 'Pat', signed: true }] }),
      ],
    });
    expect(r.ledTalks).toBe(1);
    expect(r.attendedTalks).toBe(2);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeToolboxSnapshot({
      employeeId: 'X',
      employeeName: 'Unknown',
      toolboxTalks: [],
    });
    expect(r.attendedTalks).toBe(0);
  });
});
