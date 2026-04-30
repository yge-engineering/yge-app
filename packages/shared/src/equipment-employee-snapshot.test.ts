import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentEmployeeSnapshot } from './equipment-employee-snapshot';

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

describe('buildEquipmentEmployeeSnapshot', () => {
  it('counts distinct operators with last dispatch date', () => {
    const r = buildEquipmentEmployeeSnapshot({
      equipmentId: 'eq-1',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Sam' }], scheduledFor: '2026-04-08' }),
        dp({ id: 'b', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Sam' }], scheduledFor: '2026-04-22' }),
        dp({ id: 'c', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Lou' }], scheduledFor: '2026-04-10' }),
      ],
    });
    expect(r.distinctEmployees).toBe(2);
    expect(r.totalDispatches).toBe(3);
    expect(r.rows[0]?.operatorName).toBe('Sam');
    expect(r.rows[0]?.lastDispatchDate).toBe('2026-04-22');
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentEmployeeSnapshot({ equipmentId: 'X', dispatches: [] });
    expect(r.distinctEmployees).toBe(0);
  });
});
