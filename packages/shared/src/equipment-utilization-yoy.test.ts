import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentUtilizationYoy } from './equipment-utilization-yoy';

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
    equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T', operatorName: 'Sam' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEquipmentUtilizationYoy', () => {
  it('compares two years for one unit', () => {
    const r = buildEquipmentUtilizationYoy({
      equipmentId: 'eq-1',
      currentYear: 2026,
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15' }),
        dp({ id: 'b', scheduledFor: '2026-04-15' }),
        dp({ id: 'c', scheduledFor: '2026-08-15' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.totalDelta).toBe(1);
  });

  it('counts distinct operators per year', () => {
    const r = buildEquipmentUtilizationYoy({
      equipmentId: 'eq-1',
      currentYear: 2026,
      dispatches: [
        dp({ id: 'a', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Sam' }] }),
        dp({ id: 'b', scheduledFor: '2026-08-15', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Lou' }] }),
      ],
    });
    expect(r.currentDistinctOperators).toBe(2);
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentUtilizationYoy({
      equipmentId: 'X',
      currentYear: 2026,
      dispatches: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
