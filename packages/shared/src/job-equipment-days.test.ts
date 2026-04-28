import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildJobEquipmentDays } from './job-equipment-days';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Alice',
    scopeOfWork: 'work',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildJobEquipmentDays', () => {
  it('counts distinct dispatch days per equipment piece', () => {
    const r = buildJobEquipmentDays({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'd1', scheduledFor: '2026-04-13', equipment: [{ equipmentId: 'eq1', name: 'CAT 320' }] }),
        disp({ id: 'd2', scheduledFor: '2026-04-14', equipment: [{ equipmentId: 'eq1', name: 'CAT 320' }] }),
        disp({ id: 'd3', scheduledFor: '2026-04-13', equipment: [{ equipmentId: 'eq1', name: 'CAT 320' }] }), // same day, dedupe
      ],
    });
    expect(r.rows[0]?.equipment[0]?.distinctDays).toBe(2);
  });

  it('groups equipment by id when present, by name otherwise', () => {
    const r = buildJobEquipmentDays({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'd1', equipment: [{ equipmentId: 'eq1', name: 'CAT 320' }] }),
        disp({ id: 'd2', scheduledFor: '2026-04-16', equipment: [{ name: 'F-350' }] }),
        disp({ id: 'd3', scheduledFor: '2026-04-17', equipment: [{ name: 'f-350' }] }), // canonicalize match
      ],
    });
    expect(r.rows[0]?.distinctEquipmentCount).toBe(2);
  });

  it('sums total equipment-days across job', () => {
    const r = buildJobEquipmentDays({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'a', equipment: [{ name: 'A' }, { name: 'B' }] }),
        disp({ id: 'b', scheduledFor: '2026-04-16', equipment: [{ name: 'A' }] }),
      ],
    });
    expect(r.rows[0]?.totalEquipmentDays).toBe(3);
  });

  it('skips DRAFT + CANCELLED', () => {
    const r = buildJobEquipmentDays({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'd', status: 'DRAFT', equipment: [{ name: 'A' }] }),
        disp({ id: 'p', status: 'POSTED', equipment: [{ name: 'A' }] }),
      ],
    });
    expect(r.rows[0]?.totalEquipmentDays).toBe(1);
  });

  it('respects from/to date window', () => {
    const r = buildJobEquipmentDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15', equipment: [{ name: 'A' }] }),
        disp({ id: 'in', scheduledFor: '2026-04-15', equipment: [{ name: 'A' }] }),
      ],
    });
    expect(r.rows[0]?.totalEquipmentDays).toBe(1);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobEquipmentDays({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      dispatches: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts equipment within job by distinctDays desc', () => {
    const r = buildJobEquipmentDays({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'd1', scheduledFor: '2026-04-13', equipment: [{ name: 'Heavy', equipmentId: 'h' }] }),
        disp({ id: 'd2', scheduledFor: '2026-04-14', equipment: [{ name: 'Heavy', equipmentId: 'h' }] }),
        disp({ id: 'd3', scheduledFor: '2026-04-13', equipment: [{ name: 'Light', equipmentId: 'l' }] }),
      ],
    });
    expect(r.rows[0]?.equipment[0]?.name).toBe('Heavy');
  });

  it('sorts jobs by totalEquipmentDays desc', () => {
    const r = buildJobEquipmentDays({
      jobs: [
        job({ id: 'small' }),
        job({ id: 'big' }),
      ],
      dispatches: [
        disp({ id: 'sm', jobId: 'small', equipment: [{ name: 'A' }] }),
        disp({ id: 'b1', jobId: 'big', equipment: [{ name: 'A' }, { name: 'B' }] }),
        disp({ id: 'b2', jobId: 'big', scheduledFor: '2026-04-16', equipment: [{ name: 'C' }] }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildJobEquipmentDays({ jobs: [], dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
