import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentOperatorYoy } from './equipment-operator-yoy';

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

describe('buildEquipmentOperatorYoy', () => {
  it('compares two years for one unit', () => {
    const r = buildEquipmentOperatorYoy({
      equipmentId: 'eq-1',
      currentYear: 2026,
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15', equipment: [{ equipmentId: 'eq-1', name: 'D6T', operatorName: 'Sam' }] }),
        dp({ id: 'b', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'D6T', operatorName: 'Sam' }] }),
        dp({ id: 'c', scheduledFor: '2026-08-15', equipment: [{ equipmentId: 'eq-1', name: 'D6T', operatorName: 'Lou' }] }),
      ],
    });
    expect(r.priorDistinctOperators).toBe(1);
    expect(r.currentDistinctOperators).toBe(2);
    expect(r.operatorsDelta).toBe(1);
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentOperatorYoy({ equipmentId: 'X', currentYear: 2026, dispatches: [] });
    expect(r.priorDistinctOperators).toBe(0);
  });
});
