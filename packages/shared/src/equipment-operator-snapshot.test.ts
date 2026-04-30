import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentOperatorSnapshot } from './equipment-operator-snapshot';

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

describe('buildEquipmentOperatorSnapshot', () => {
  it('counts distinct operators + top-N', () => {
    const r = buildEquipmentOperatorSnapshot({
      equipmentId: 'eq-1',
      asOf: '2026-04-30',
      topN: 5,
      dispatches: [
        dp({ id: 'a', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Sam' }] }),
        dp({ id: 'b', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Sam' }] }),
        dp({ id: 'c', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Lou' }] }),
      ],
    });
    expect(r.distinctOperators).toBe(2);
    expect(r.totalDispatches).toBe(3);
    expect(r.topOperators[0]?.operatorName).toBe('Sam');
    expect(r.topOperators[0]?.dispatches).toBe(2);
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentOperatorSnapshot({ equipmentId: 'X', dispatches: [] });
    expect(r.distinctOperators).toBe(0);
  });
});
