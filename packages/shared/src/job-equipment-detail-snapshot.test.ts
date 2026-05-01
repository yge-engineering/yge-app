import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildJobEquipmentDetailSnapshot } from './job-equipment-detail-snapshot';

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

describe('buildJobEquipmentDetailSnapshot', () => {
  it('returns one row per equipment unit sorted by slots', () => {
    const r = buildJobEquipmentDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dispatches: [
        ds({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-13', equipment: [{ equipmentId: 'eq-cat', name: 'CAT 320E', operatorName: 'Pat' }, { name: 'Water Truck', operatorName: 'Sam' }] }),
        ds({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-14', equipment: [{ equipmentId: 'eq-cat', name: 'CAT 320E', operatorName: 'Pat' }] }),
        ds({ id: 'c', jobId: 'j1', scheduledFor: '2026-04-15', equipment: [{ name: 'Water Truck', operatorName: 'Lee' }] }),
        ds({ id: 'd', jobId: 'j2', scheduledFor: '2026-04-16', equipment: [{ name: 'Other' }] }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.slots).toBe(2);
    expect(r.rows[0]?.distinctDays).toBe(2);
    expect(r.rows[0]?.distinctOperators).toBe(1);
    expect(r.rows[1]?.slots).toBe(2);
    expect(r.rows[1]?.distinctOperators).toBe(2);
  });

  it('handles unknown job', () => {
    const r = buildJobEquipmentDetailSnapshot({ jobId: 'X', dispatches: [] });
    expect(r.rows.length).toBe(0);
  });
});
