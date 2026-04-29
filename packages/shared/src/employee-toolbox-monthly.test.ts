import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildEmployeeToolboxMonthly } from './employee-toolbox-monthly';

function tbt(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    heldOn: '2026-04-15',
    topic: 'PPE',
    leaderName: 'Brook',
    attendees: [{ employeeId: 'e1', name: 'Joe', signed: true }],
    status: 'SUBMITTED',
    ...over,
  } as ToolboxTalk;
}

describe('buildEmployeeToolboxMonthly', () => {
  it('groups by (employee, month)', () => {
    const r = buildEmployeeToolboxMonthly({
      toolboxTalks: [
        tbt({ id: 'a', heldOn: '2026-03-15', attendees: [{ employeeId: 'e1', name: 'Joe', signed: true }] }),
        tbt({ id: 'b', heldOn: '2026-04-15', attendees: [{ employeeId: 'e1', name: 'Joe', signed: true }] }),
        tbt({ id: 'c', heldOn: '2026-04-15', attendees: [{ employeeId: 'e2', name: 'Mary', signed: true }] }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts talks attended + signed', () => {
    const r = buildEmployeeToolboxMonthly({
      toolboxTalks: [
        tbt({
          id: 'a',
          attendees: [
            { employeeId: 'e1', name: 'Joe', signed: true },
            { employeeId: 'e1', name: 'Joe', signed: false },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.talksAttended).toBe(2);
    expect(r.rows[0]?.signedCount).toBe(1);
  });

  it('counts distinct topics + leaders', () => {
    const r = buildEmployeeToolboxMonthly({
      toolboxTalks: [
        tbt({ id: 'a', topic: 'PPE', leaderName: 'Brook' }),
        tbt({ id: 'b', topic: 'PPE', leaderName: 'Ryan' }),
        tbt({ id: 'c', topic: 'Trenching', leaderName: 'Brook' }),
      ],
    });
    expect(r.rows[0]?.distinctTopics).toBe(2);
    expect(r.rows[0]?.distinctLeaders).toBe(2);
  });

  it('skips attendees with no employeeId (visitors)', () => {
    const r = buildEmployeeToolboxMonthly({
      toolboxTalks: [
        tbt({
          attendees: [
            { employeeId: 'e1', name: 'Joe', signed: true },
            { name: 'Visitor', signed: true },
          ],
        }),
      ],
    });
    expect(r.rollup.totalAttendances).toBe(1);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildEmployeeToolboxMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      toolboxTalks: [
        tbt({ id: 'mar', heldOn: '2026-03-15' }),
        tbt({ id: 'apr', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalAttendances).toBe(1);
  });

  it('sorts by employeeId asc, month asc', () => {
    const r = buildEmployeeToolboxMonthly({
      toolboxTalks: [
        tbt({ id: 'a', heldOn: '2026-04-15', attendees: [{ employeeId: 'Z', name: 'X', signed: true }] }),
        tbt({ id: 'b', heldOn: '2026-04-15', attendees: [{ employeeId: 'A', name: 'X', signed: true }] }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildEmployeeToolboxMonthly({ toolboxTalks: [] });
    expect(r.rows).toHaveLength(0);
  });
});
