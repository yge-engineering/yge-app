import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentJobDetailSnapshot } from './equipment-job-detail-snapshot';

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
    equipment: [{ equipmentId: 'eq-1', name: 'D6T' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEquipmentJobDetailSnapshot', () => {
  it('returns one row per job with dispatch count + last date', () => {
    const r = buildEquipmentJobDetailSnapshot({
      equipmentId: 'eq-1',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-08' }),
        dp({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-22' }),
        dp({ id: 'c', jobId: 'j2', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.dispatches).toBe(2);
    expect(r.rows[0]?.lastDispatchDate).toBe('2026-04-22');
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentJobDetailSnapshot({ equipmentId: 'X', dispatches: [] });
    expect(r.rows.length).toBe(0);
  });
});
