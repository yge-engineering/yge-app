import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEmployeeEquipmentSnapshot } from './employee-equipment-snapshot';

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

describe('buildEmployeeEquipmentSnapshot', () => {
  it('counts distinct units operated + top-N', () => {
    const r = buildEmployeeEquipmentSnapshot({
      employeeName: 'Sam',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', equipment: [{ equipmentId: 'eq-1', name: 'D6T', operatorName: 'Sam' }] }),
        dp({ id: 'b', equipment: [{ equipmentId: 'eq-1', name: 'D6T', operatorName: 'Sam' }] }),
        dp({ id: 'c', equipment: [{ equipmentId: 'eq-2', name: '320E', operatorName: 'Sam' }] }),
        dp({ id: 'd', equipment: [{ equipmentId: 'eq-3', name: '420F', operatorName: 'Lou' }] }),
      ],
    });
    expect(r.distinctUnits).toBe(2);
    expect(r.topUnits[0]?.equipmentKey).toBe('eq-1');
    expect(r.topUnits[0]?.dispatches).toBe(2);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeEquipmentSnapshot({ employeeName: 'X', dispatches: [] });
    expect(r.distinctUnits).toBe(0);
  });
});
