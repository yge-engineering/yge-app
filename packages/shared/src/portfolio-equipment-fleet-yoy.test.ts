import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildPortfolioEquipmentFleetYoy } from './portfolio-equipment-fleet-yoy';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2025-06-15T00:00:00.000Z',
    updatedAt: '2025-06-15T00:00:00.000Z',
    name: 'CAT',
    category: 'EXCAVATOR',
    usageMetric: 'HOURS',
    currentUsage: 0,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildPortfolioEquipmentFleetYoy', () => {
  it('compares year-end fleet sizes', () => {
    const r = buildPortfolioEquipmentFleetYoy({
      currentYear: 2026,
      equipment: [
        eq({ id: 'a', createdAt: '2025-01-15T00:00:00Z' }),
        eq({ id: 'b', createdAt: '2026-06-15T00:00:00Z' }),
      ],
    });
    expect(r.prior.totalUnits).toBe(1);
    expect(r.current.totalUnits).toBe(2);
    expect(r.totalUnitsDelta).toBe(1);
  });

  it('splits active vs inactive', () => {
    const r = buildPortfolioEquipmentFleetYoy({
      currentYear: 2026,
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'ASSIGNED' }),
        eq({ id: 'c', status: 'OUT_FOR_REPAIR' }),
        eq({ id: 'd', status: 'SOLD' }),
      ],
    });
    expect(r.current.activeCount).toBe(2);
    expect(r.current.inactiveCount).toBe(2);
  });

  it('breaks down by status', () => {
    const r = buildPortfolioEquipmentFleetYoy({
      currentYear: 2026,
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'IN_YARD' }),
        eq({ id: 'c', status: 'ASSIGNED' }),
      ],
    });
    expect(r.current.byStatus.IN_YARD).toBe(2);
    expect(r.current.byStatus.ASSIGNED).toBe(1);
  });

  it('skips equipment whose createdAt is after snapshot date', () => {
    const r = buildPortfolioEquipmentFleetYoy({
      currentYear: 2026,
      equipment: [eq({ id: 'a', createdAt: '2027-01-15T00:00:00Z' })],
    });
    expect(r.current.totalUnits).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioEquipmentFleetYoy({ currentYear: 2026, equipment: [] });
    expect(r.current.totalUnits).toBe(0);
  });
});
