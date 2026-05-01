import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildJobDispatchDetailSnapshot } from './job-dispatch-detail-snapshot';

function ds(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Mike',
    scopeOfWork: 'X',
    crew: [{ name: 'Pat' }],
    equipment: [{ name: 'CAT 320E' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildJobDispatchDetailSnapshot', () => {
  it('returns one row per foreman sorted by total', () => {
    const r = buildJobDispatchDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dispatches: [
        ds({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-13', foremanName: 'Mike', status: 'COMPLETED', crew: [{ name: 'Pat' }, { name: 'Sam' }], equipment: [{ name: 'CAT 320E' }] }),
        ds({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-14', foremanName: 'Mike', status: 'POSTED', crew: [{ name: 'Pat' }], equipment: [{ name: 'Water Truck' }] }),
        ds({ id: 'c', jobId: 'j1', scheduledFor: '2026-04-15', foremanName: 'Joe', status: 'POSTED', crew: [{ name: 'Lee' }] }),
        ds({ id: 'd', jobId: 'j2', scheduledFor: '2026-04-16', foremanName: 'Mike' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.foremanName).toBe('Mike');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.posted).toBe(1);
    expect(r.rows[0]?.completed).toBe(1);
    expect(r.rows[0]?.distinctCrew).toBe(2);
    expect(r.rows[0]?.distinctEquipment).toBe(2);
    expect(r.rows[1]?.foremanName).toBe('Joe');
    expect(r.rows[1]?.distinctCrew).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobDispatchDetailSnapshot({ jobId: 'X', dispatches: [] });
    expect(r.rows.length).toBe(0);
  });
});
