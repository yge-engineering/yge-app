import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

import { buildPortfolioEquipmentYoy } from './portfolio-equipment-yoy';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'work',
    crew: [],
    equipment: [{ equipmentId: 'eq-1', name: 'CAT' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '',
    updatedAt: '',
    name: 'CAT',
    category: 'EXCAVATOR',
    usageMetric: 'HOURS',
    currentUsage: 0,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildPortfolioEquipmentYoy', () => {
  it('compares prior vs current dispatch days + units', () => {
    const r = buildPortfolioEquipmentYoy({
      currentYear: 2026,
      equipment: [],
      dispatches: [
        disp({ id: 'a', scheduledFor: '2025-04-15' }),
        disp({ id: 'b', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', scheduledFor: '2026-04-16' }),
      ],
    });
    expect(r.priorDispatchDays).toBe(1);
    expect(r.currentDispatchDays).toBe(2);
    expect(r.dispatchDaysDelta).toBe(1);
  });

  it('counts maintenance events + cost per year', () => {
    const r = buildPortfolioEquipmentYoy({
      currentYear: 2026,
      dispatches: [],
      equipment: [
        eq({
          maintenanceLog: [
            { performedAt: '2025-04-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'a', costCents: 50_00 },
            { performedAt: '2026-04-15', usageAtService: 200, kind: 'INSPECTION', description: 'b', costCents: 100_00 },
          ] as Equipment['maintenanceLog'],
        }),
      ],
    });
    expect(r.priorMaintenanceEvents).toBe(1);
    expect(r.currentMaintenanceEvents).toBe(1);
    expect(r.priorMaintenanceCostCents).toBe(50_00);
    expect(r.currentMaintenanceCostCents).toBe(100_00);
  });

  it('skips DRAFT + CANCELLED dispatches', () => {
    const r = buildPortfolioEquipmentYoy({
      currentYear: 2026,
      equipment: [],
      dispatches: [
        disp({ id: 'a', status: 'POSTED' }),
        disp({ id: 'b', status: 'DRAFT' }),
        disp({ id: 'c', status: 'CANCELLED' }),
      ],
    });
    expect(r.currentDispatchDays).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioEquipmentYoy({
      currentYear: 2026,
      dispatches: [],
      equipment: [],
    });
    expect(r.priorDispatchDays).toBe(0);
    expect(r.currentDispatchDays).toBe(0);
  });
});
