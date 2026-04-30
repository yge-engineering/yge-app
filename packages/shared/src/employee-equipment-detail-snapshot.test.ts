import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEmployeeEquipmentDetailSnapshot } from './employee-equipment-detail-snapshot';

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

describe('buildEmployeeEquipmentDetailSnapshot', () => {
  it('returns one row per job sorted by distinct units', () => {
    const r = buildEmployeeEquipmentDetailSnapshot({
      employeeId: 'e1',
      employeeName: 'Pat',
      asOf: '2026-04-30',
      dispatches: [
        ds({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-13', equipment: [{ name: 'CAT 320E', operatorName: 'Pat' }, { name: 'Water Truck', operatorName: 'Pat' }] }),
        ds({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-14', equipment: [{ name: 'CAT 320E', operatorName: 'pat' }] }),
        ds({ id: 'c', jobId: 'j2', scheduledFor: '2026-04-15', equipment: [{ name: 'Roller', operatorName: 'Pat' }] }),
        ds({ id: 'd', jobId: 'j3', scheduledFor: '2026-04-16', equipment: [{ name: 'Other', operatorName: 'Sam' }] }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.distinctUnits).toBe(2);
    expect(r.rows[0]?.totalSlots).toBe(3);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.distinctUnits).toBe(1);
  });

  it('handles no matches', () => {
    const r = buildEmployeeEquipmentDetailSnapshot({ employeeId: 'X', dispatches: [] });
    expect(r.rows.length).toBe(0);
  });
});
