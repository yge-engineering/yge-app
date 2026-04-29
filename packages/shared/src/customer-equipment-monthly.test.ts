import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildCustomerEquipmentMonthly } from './customer-equipment-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'work',
    crew: [],
    equipment: [{ equipmentId: 'eq-1', name: 'CAT 320E' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildCustomerEquipmentMonthly', () => {
  it('groups equipment lines by (customer, month)', () => {
    const r = buildCustomerEquipmentMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      dispatches: [
        disp({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', jobId: 'j2', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', jobId: 'j1', scheduledFor: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts distinct units + dates + jobs', () => {
    const r = buildCustomerEquipmentMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans D2' }),
      ],
      dispatches: [
        disp({
          id: 'a',
          jobId: 'j1',
          scheduledFor: '2026-04-15',
          equipment: [
            { equipmentId: 'eq-1', name: 'CAT' },
            { equipmentId: 'eq-2', name: 'Roller' },
          ],
        }),
        disp({
          id: 'b',
          jobId: 'j2',
          scheduledFor: '2026-04-16',
          equipment: [{ equipmentId: 'eq-1', name: 'CAT' }],
        }),
      ],
    });
    expect(r.rows[0]?.distinctUnits).toBe(2);
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.equipmentLines).toBe(3);
  });

  it('skips DRAFT and CANCELLED dispatches', () => {
    const r = buildCustomerEquipmentMonthly({
      jobs: [job({ id: 'j1' })],
      dispatches: [
        disp({ id: 'a', status: 'POSTED' }),
        disp({ id: 'b', status: 'DRAFT' }),
        disp({ id: 'c', status: 'CANCELLED' }),
      ],
    });
    expect(r.rollup.draftSkipped).toBe(1);
    expect(r.rollup.cancelledSkipped).toBe(1);
  });

  it('counts unattributed (no matching job)', () => {
    const r = buildCustomerEquipmentMonthly({
      jobs: [job({ id: 'j1' })],
      dispatches: [
        disp({ id: 'a', jobId: 'j1' }),
        disp({ id: 'b', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerEquipmentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerEquipmentMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      dispatches: [
        disp({ id: 'a', jobId: 'jZ', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', jobId: 'jA', scheduledFor: '2026-05-01' }),
        disp({ id: 'c', jobId: 'jA', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerEquipmentMonthly({ jobs: [], dispatches: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalLines).toBe(0);
  });
});
