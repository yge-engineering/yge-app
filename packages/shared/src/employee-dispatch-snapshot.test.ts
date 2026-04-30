import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEmployeeDispatchSnapshot } from './employee-dispatch-snapshot';

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

describe('buildEmployeeDispatchSnapshot', () => {
  it('counts foreman appearances', () => {
    const r = buildEmployeeDispatchSnapshot({
      employeeId: 'e1',
      employeeName: 'Pat',
      asOf: '2026-04-30',
      dispatches: [dp({ id: 'a', foremanName: 'Pat' })],
    });
    expect(r.asForeman).toBe(1);
    expect(r.totalAppearances).toBe(1);
  });

  it('counts crew appearances by employeeId', () => {
    const r = buildEmployeeDispatchSnapshot({
      employeeId: 'e1',
      employeeName: 'Pat',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', foremanName: 'Sam', crew: [{ employeeId: 'e1', name: 'Pat' }] }),
      ],
    });
    expect(r.asCrew).toBe(1);
    expect(r.totalAppearances).toBe(1);
  });

  it('counts crew appearances by name fallback', () => {
    const r = buildEmployeeDispatchSnapshot({
      employeeId: 'e1',
      employeeName: 'Pat',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', foremanName: 'Sam', crew: [{ name: 'Pat' }] }),
      ],
    });
    expect(r.asCrew).toBe(1);
  });

  it('counts both foreman and crew on same dispatch as one appearance', () => {
    const r = buildEmployeeDispatchSnapshot({
      employeeId: 'e1',
      employeeName: 'Pat',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', foremanName: 'Pat', crew: [{ employeeId: 'e1', name: 'Pat' }] }),
      ],
    });
    expect(r.asForeman).toBe(1);
    expect(r.asCrew).toBe(1);
    expect(r.totalAppearances).toBe(1);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeDispatchSnapshot({
      employeeId: 'X',
      employeeName: 'X',
      dispatches: [],
    });
    expect(r.totalAppearances).toBe(0);
  });
});
