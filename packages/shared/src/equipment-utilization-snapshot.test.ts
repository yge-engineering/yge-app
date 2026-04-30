import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentUtilizationSnapshot } from './equipment-utilization-snapshot';

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

describe('buildEquipmentUtilizationSnapshot', () => {
  it('counts dispatches that included the unit by id', () => {
    const r = buildEquipmentUtilizationSnapshot({
      equipmentId: 'eq-1',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a' }),
        dp({ id: 'b', equipment: [{ equipmentId: 'eq-2', name: 'Other' }] }),
      ],
    });
    expect(r.totalDispatches).toBe(1);
  });

  it('falls back to name match when equipmentId missing', () => {
    const r = buildEquipmentUtilizationSnapshot({
      equipmentId: 'eq-1',
      equipmentName: 'Cat D6T',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', equipment: [{ name: 'Cat D6T' }] }),
      ],
    });
    expect(r.totalDispatches).toBe(1);
  });

  it('counts distinct jobs + operators + foremen', () => {
    const r = buildEquipmentUtilizationSnapshot({
      equipmentId: 'eq-1',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', jobId: 'j1', foremanName: 'Pat', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Sam' }] }),
        dp({ id: 'b', jobId: 'j2', foremanName: 'Skip', equipment: [{ equipmentId: 'eq-1', name: 'X', operatorName: 'Lou' }] }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
    expect(r.distinctForemen).toBe(2);
    expect(r.distinctOperators).toBe(2);
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentUtilizationSnapshot({ equipmentId: 'X', dispatches: [] });
    expect(r.totalDispatches).toBe(0);
  });
});
