import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildEmployeeTimecardDetailSnapshot } from './employee-timecard-detail-snapshot';

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    weekStarting: '2026-04-13',
    status: 'SUBMITTED',
    entries: [],
    ...over,
  } as TimeCard;
}

describe('buildEmployeeTimecardDetailSnapshot', () => {
  it('returns one row per job sorted by hours', () => {
    const r = buildEmployeeTimecardDetailSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      timeCards: [
        tc({
          id: 'a',
          employeeId: 'e1',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' },
            { date: '2026-04-14', jobId: 'j2', startTime: '07:00', endTime: '11:00' },
            { date: '2026-04-15', jobId: 'j1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
        tc({
          id: 'b',
          employeeId: 'e2',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.hours).toBe(16);
    expect(r.rows[0]?.daysWorked).toBe(2);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.hours).toBe(4);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeTimecardDetailSnapshot({ employeeId: 'X', timeCards: [] });
    expect(r.rows.length).toBe(0);
  });
});
