import { describe, it, expect } from 'vitest';
import {
  EquipmentInspectionSchema,
  EquipmentInspectionCreateSchema,
  EquipmentInspectionPatchSchema,
  equipmentInspectionDeficiencyCount,
  equipmentInspectionHasIssues,
  equipmentInspectionTypeLabel,
  newEquipmentInspectionId,
} from './equipment-inspection';

const baseValid = {
  id: 'ei-12345678',
  createdAt: '2026-05-22T08:00:00Z',
  updatedAt: '2026-05-22T08:00:00Z',
  equipmentId: 'eq-cat320',
  inspectedOn: '2026-05-22',
  inspectorName: 'Ryan Young',
  checks: [
    { name: 'Tires/tracks', status: 'PASS' as const },
    { name: 'Hydraulics', status: 'FAIL' as const, notes: 'Leak at boom cylinder' },
    { name: 'Safety devices', status: 'NEEDS_ATTENTION' as const },
  ],
  outOfService: true,
  outOfServiceReason: 'Hydraulic leak',
  photoRefs: [],
};

describe('EquipmentInspectionSchema', () => {
  it('parses a valid record and applies defaults', () => {
    const minimal = {
      id: 'ei-12345678',
      createdAt: '2026-05-22T08:00:00Z',
      updatedAt: '2026-05-22T08:00:00Z',
      equipmentId: 'eq-1',
      inspectedOn: '2026-05-22',
      inspectorName: 'Foreman',
    };
    const parsed = EquipmentInspectionSchema.parse(minimal);
    expect(parsed.type).toBe('PRE_SHIFT');
    expect(parsed.checks).toEqual([]);
    expect(parsed.outOfService).toBe(false);
    expect(parsed.photoRefs).toEqual([]);
  });

  it('rejects a bad inspectedOn date format', () => {
    const bad = { ...baseValid, inspectedOn: '5/22/2026' };
    expect(EquipmentInspectionSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a bad inspectedAt time format', () => {
    const bad = { ...baseValid, inspectedAt: '8am' };
    expect(EquipmentInspectionSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a valid inspectedAt time', () => {
    const ok = { ...baseValid, inspectedAt: '07:15' };
    expect(EquipmentInspectionSchema.safeParse(ok).success).toBe(true);
  });
});

describe('EquipmentInspectionCreateSchema', () => {
  it('omits id and timestamps and accepts optional defaults', () => {
    const input = {
      equipmentId: 'eq-1',
      inspectedOn: '2026-05-22',
      inspectorName: 'Foreman',
    };
    const parsed = EquipmentInspectionCreateSchema.parse(input);
    expect(parsed.equipmentId).toBe('eq-1');
  });
});

describe('EquipmentInspectionPatchSchema', () => {
  it('accepts an empty patch (all fields optional)', () => {
    expect(EquipmentInspectionPatchSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a partial patch', () => {
    const patch = { outOfService: false, outOfServiceReason: undefined };
    expect(EquipmentInspectionPatchSchema.safeParse(patch).success).toBe(true);
  });
});

describe('equipmentInspectionDeficiencyCount', () => {
  it('counts FAIL and NEEDS_ATTENTION but ignores PASS / NOT_APPLICABLE', () => {
    const c = equipmentInspectionDeficiencyCount({
      checks: [
        { name: 'a', status: 'PASS' },
        { name: 'b', status: 'FAIL' },
        { name: 'c', status: 'NEEDS_ATTENTION' },
        { name: 'd', status: 'NOT_APPLICABLE' },
      ],
    });
    expect(c).toBe(2);
  });

  it('returns 0 for no checks', () => {
    expect(equipmentInspectionDeficiencyCount({ checks: [] })).toBe(0);
  });
});

describe('equipmentInspectionHasIssues', () => {
  it('is true when out-of-service even with all-PASS checks', () => {
    expect(
      equipmentInspectionHasIssues({
        checks: [{ name: 'a', status: 'PASS' }],
        outOfService: true,
      }),
    ).toBe(true);
  });

  it('is true when any deficiency exists', () => {
    expect(
      equipmentInspectionHasIssues({
        checks: [{ name: 'a', status: 'FAIL' }],
        outOfService: false,
      }),
    ).toBe(true);
  });

  it('is false when everything passes and not OOS', () => {
    expect(
      equipmentInspectionHasIssues({
        checks: [{ name: 'a', status: 'PASS' }],
        outOfService: false,
      }),
    ).toBe(false);
  });
});

describe('equipmentInspectionTypeLabel', () => {
  it('lowercases and replaces underscores', () => {
    expect(equipmentInspectionTypeLabel('PRE_SHIFT')).toBe('pre shift');
    expect(equipmentInspectionTypeLabel('POST_INCIDENT')).toBe('post incident');
  });
});

describe('newEquipmentInspectionId', () => {
  it('produces an id matching the ei-<8chars> pattern', () => {
    const id = newEquipmentInspectionId();
    expect(id).toMatch(/^ei-[a-z0-9]{8}$/);
  });
});
