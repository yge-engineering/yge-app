import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildEmployeeToolboxYoy } from './employee-toolbox-yoy';

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tb-1',
    createdAt: '',
    updatedAt: '',
    heldOn: '2026-04-15',
    jobId: 'j1',
    topic: 'Heat',
    leaderName: 'Pat',
    attendees: [{ employeeId: 'e1', name: 'Pat', signed: true }],
    ...over,
  } as ToolboxTalk;
}

describe('buildEmployeeToolboxYoy', () => {
  it('compares two years for one employee', () => {
    const r = buildEmployeeToolboxYoy({
      employeeId: 'e1',
      employeeName: 'Pat',
      currentYear: 2026,
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2025-04-15' }),
        tb({ id: 'b', heldOn: '2026-04-15' }),
        tb({ id: 'c', heldOn: '2026-08-15' }),
      ],
    });
    expect(r.priorAttended).toBe(1);
    expect(r.currentAttended).toBe(2);
    expect(r.attendedDelta).toBe(1);
  });

  it('counts led talks per year', () => {
    const r = buildEmployeeToolboxYoy({
      employeeId: 'e1',
      employeeName: 'Pat',
      currentYear: 2026,
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2026-04-15', leaderName: 'Pat', attendees: [] }),
      ],
    });
    expect(r.currentLed).toBe(1);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeToolboxYoy({
      employeeId: 'X',
      employeeName: 'X',
      currentYear: 2026,
      toolboxTalks: [],
    });
    expect(r.priorAttended).toBe(0);
  });
});
