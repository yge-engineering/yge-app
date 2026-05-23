import { describe, it, expect } from 'vitest';
import {
  EquipmentServiceRecordSchema,
  EquipmentServiceRecordCreateSchema,
  EquipmentServiceRecordPatchSchema,
  isServiceRecordOpen,
  totalPartsCostCents,
  totalLaborCostCents,
  totalRepairCostCents,
  serviceRecordPriorityLabel,
  serviceRecordCategoryLabel,
  shouldRedTag,
  newServiceRecordId,
} from './equipment-service-record';

const base = (over: Record<string, unknown> = {}) =>
  EquipmentServiceRecordSchema.parse({
    id: 'wo-12345678',
    createdAt: '2026-05-22T08:00:00Z',
    updatedAt: '2026-05-22T08:00:00Z',
    equipmentId: 'eq-cat320',
    openedOn: '2026-05-22',
    requestedByName: 'Foreman Ryan',
    description: 'Hydraulic leak at boom cylinder',
    parts: [],
    photoRefs: [],
    ...over,
  });

describe('EquipmentServiceRecordSchema', () => {
  it('parses + applies defaults', () => {
    const r = base();
    expect(r.status).toBe('OPEN');
    expect(r.priority).toBe('MEDIUM');
    expect(r.category).toBe('OTHER');
    expect(r.laborHours).toBe(0);
    expect(r.redTagged).toBe(false);
  });
});

describe('Create/Patch', () => {
  it('Create omits id and timestamps', () => {
    expect(
      EquipmentServiceRecordCreateSchema.parse({
        equipmentId: 'eq-1',
        openedOn: '2026-05-22',
        requestedByName: 'Ryan',
        description: 'Test',
      }).description,
    ).toBe('Test');
  });
  it('Patch accepts empty', () => {
    expect(EquipmentServiceRecordPatchSchema.safeParse({}).success).toBe(true);
  });
});

describe('isServiceRecordOpen', () => {
  it('true for OPEN/IN_PROGRESS', () => {
    expect(isServiceRecordOpen({ status: 'OPEN' })).toBe(true);
    expect(isServiceRecordOpen({ status: 'IN_PROGRESS' })).toBe(true);
    expect(isServiceRecordOpen({ status: 'CLOSED' })).toBe(false);
    expect(isServiceRecordOpen({ status: 'CANCELLED' })).toBe(false);
  });
});

describe('total* helpers', () => {
  it('parts sums qty × unitCost', () => {
    expect(
      totalPartsCostCents({
        parts: [
          { partName: 'Filter', quantity: 2, unitCostCents: 1500 },
          { partName: 'O-ring kit', quantity: 1, unitCostCents: 3000 },
        ],
      }),
    ).toBe(6000);
  });
  it('labor multiplies hours × rate', () => {
    expect(totalLaborCostCents({ laborHours: 2.5, laborRateCentsPerHour: 10000 })).toBe(25000);
  });
  it('repair combines', () => {
    const r = base({
      parts: [{ partName: 'X', quantity: 1, unitCostCents: 5000 }],
      laborHours: 3,
      laborRateCentsPerHour: 8000,
    });
    expect(totalRepairCostCents(r)).toBe(29000);
  });
});

describe('label helpers', () => {
  it('priority', () => {
    expect(serviceRecordPriorityLabel('SAFETY_CRITICAL')).toBe('safety critical');
  });
  it('category', () => {
    expect(serviceRecordCategoryLabel('TIRES_TRACKS')).toBe('tires tracks');
  });
});

describe('shouldRedTag', () => {
  it('SAFETY_CRITICAL while open → red-tag', () => {
    expect(shouldRedTag({ priority: 'SAFETY_CRITICAL', status: 'OPEN', redTagged: false })).toBe(true);
  });
  it('SAFETY_CRITICAL but CLOSED → no red-tag', () => {
    expect(shouldRedTag({ priority: 'SAFETY_CRITICAL', status: 'CLOSED', redTagged: true })).toBe(false);
  });
  it('explicit flag honored on non-critical', () => {
    expect(shouldRedTag({ priority: 'HIGH', status: 'OPEN', redTagged: true })).toBe(true);
    expect(shouldRedTag({ priority: 'HIGH', status: 'OPEN', redTagged: false })).toBe(false);
  });
});

describe('newServiceRecordId', () => {
  it('matches wo-<8chars>', () => {
    expect(newServiceRecordId()).toMatch(/^wo-[a-z0-9]{8}$/);
  });
});
