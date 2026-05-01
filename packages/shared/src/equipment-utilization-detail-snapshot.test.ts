import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentUtilizationDetailSnapshot } from './equipment-utilization-detail-snapshot';

function ds(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Mike',
    scopeOfWork: 'X',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEquipmentUtilizationDetailSnapshot', () => {
  it('returns one row per job sorted by slots', () => {
    const r = buildEquipmentUtilizationDetailSnapshot({
      equipmentId: 'eq-cat320',
      equipmentName: 'CAT 320E',
      asOf: '2026-04-30',
      dispatches: [
        ds({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-13', equipment: [{ equipmentId: 'eq-cat320', name: 'CAT 320E', operatorName: 'Pat' }] }),
        ds({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-14', equipment: [{ name: 'CAT 320E', operatorName: 'Sam' }] }),
        ds({ id: 'c', jobId: 'j2', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-cat320', name: 'CAT 320E', operatorName: 'Pat' }] }),
        ds({ id: 'd', jobId: 'j1', scheduledFor: '2026-04-16', equipment: [{ name: 'Other', operatorName: 'Lee' }] }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.slots).toBe(2);
    expect(r.rows[0]?.distinctDays).toBe(2);
    expect(r.rows[0]?.distinctOperators).toBe(2);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.slots).toBe(1);
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentUtilizationDetailSnapshot({ equipmentId: 'X', dispatches: [] });
    expect(r.rows.length).toBe(0);
  });
});
