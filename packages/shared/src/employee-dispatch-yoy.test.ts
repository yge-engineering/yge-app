import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEmployeeDispatchYoy } from './employee-dispatch-yoy';

function dp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'X',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEmployeeDispatchYoy', () => {
  it('compares two years for one employee', () => {
    const r = buildEmployeeDispatchYoy({
      employeeId: 'e1',
      employeeName: 'Pat',
      currentYear: 2026,
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15', foremanName: 'Pat' }),
        dp({ id: 'b', scheduledFor: '2026-04-15', foremanName: 'Pat' }),
        dp({ id: 'c', scheduledFor: '2026-08-15', foremanName: 'Sam', crew: [{ employeeId: 'e1', name: 'Pat' }] }),
      ],
    });
    expect(r.priorAppearances).toBe(1);
    expect(r.currentAppearances).toBe(2);
    expect(r.priorAsForeman).toBe(1);
    expect(r.currentAsForeman).toBe(1);
    expect(r.currentAsCrew).toBe(1);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeDispatchYoy({
      employeeId: 'X',
      employeeName: 'X',
      currentYear: 2026,
      dispatches: [],
    });
    expect(r.priorAppearances).toBe(0);
  });
});
