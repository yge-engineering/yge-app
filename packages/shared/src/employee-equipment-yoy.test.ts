import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEmployeeEquipmentYoy } from './employee-equipment-yoy';

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
    equipment: [{ equipmentId: 'eq-1', name: 'D6T', operatorName: 'Sam' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEmployeeEquipmentYoy', () => {
  it('compares two years for one operator', () => {
    const r = buildEmployeeEquipmentYoy({
      employeeName: 'Sam',
      currentYear: 2026,
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15', equipment: [{ equipmentId: 'eq-1', name: 'D6T', operatorName: 'Sam' }] }),
        dp({ id: 'b', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'D6T', operatorName: 'Sam' }] }),
        dp({ id: 'c', scheduledFor: '2026-08-15', equipment: [{ equipmentId: 'eq-2', name: '320E', operatorName: 'Sam' }] }),
      ],
    });
    expect(r.priorDistinctUnits).toBe(1);
    expect(r.currentDistinctUnits).toBe(2);
    expect(r.dispatchesDelta).toBe(1);
  });

  it('handles unknown operator', () => {
    const r = buildEmployeeEquipmentYoy({ employeeName: 'X', currentYear: 2026, dispatches: [] });
    expect(r.priorDistinctUnits).toBe(0);
  });
});
