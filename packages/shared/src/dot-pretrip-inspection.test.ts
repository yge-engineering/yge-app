import { describe, it, expect } from 'vitest';
import {
  DotInspectionReportSchema,
  SAFETY_CRITICAL_POINTS,
  blankChecklist,
  pointLabel,
  verdictFor,
  type DotInspectionReport,
} from './dot-pretrip-inspection';

function report(over: Partial<DotInspectionReport> = {}): DotInspectionReport {
  return DotInspectionReportSchema.parse({
    id: 'dvir-1',
    driverId: 'emp-1',
    driverName: 'Smith, Sam',
    powerUnit: 'Truck-7',
    trailerId: 'Lowboy-2',
    odometer: 142315,
    inspectionDate: '2026-05-22',
    kind: 'PRE_TRIP',
    points: blankChecklist(),
    ...over,
  });
}

describe('blankChecklist', () => {
  it('covers all §396.11(c) points', () => {
    const list = blankChecklist();
    expect(list).toHaveLength(12);
    expect(list.every((p) => p.status === 'OK')).toBe(true);
  });
});

describe('verdictFor — clean inspection', () => {
  it('readyToDrive when no defects', () => {
    const v = verdictFor(report());
    expect(v.defectCount).toBe(0);
    expect(v.readyToDrive).toBe(true);
    expect(v.requiresMechanicSignoff).toBe(false);
  });
});

describe('verdictFor — non-critical defect', () => {
  it('still ready to drive but mechanic sign-off required', () => {
    const points = blankChecklist();
    const horn = points.find((p) => p.kind === 'HORN');
    if (horn) horn.status = 'DEFECT';
    const v = verdictFor(report({ points }));
    expect(v.defectCount).toBe(1);
    expect(v.safetyCriticalDefectCount).toBe(0);
    expect(v.readyToDrive).toBe(true);
    expect(v.requiresMechanicSignoff).toBe(true);
  });
});

describe('verdictFor — safety-critical defect', () => {
  it('takes the truck off the road', () => {
    const points = blankChecklist();
    const brakes = points.find((p) => p.kind === 'SERVICE_BRAKES');
    if (brakes) brakes.status = 'DEFECT';
    const v = verdictFor(report({ points }));
    expect(v.safetyCriticalDefectCount).toBe(1);
    expect(v.readyToDrive).toBe(false);
    expect(v.requiresMechanicSignoff).toBe(true);
  });

  it('every SAFETY_CRITICAL_POINTS entry actually triggers readyToDrive=false', () => {
    for (const kind of SAFETY_CRITICAL_POINTS) {
      const points = blankChecklist();
      const point = points.find((p) => p.kind === kind);
      if (point) point.status = 'DEFECT';
      const v = verdictFor(report({ points }));
      expect(v.readyToDrive).toBe(false);
    }
  });
});

describe('pointLabel', () => {
  it('returns human labels for all kinds', () => {
    expect(pointLabel('SERVICE_BRAKES')).toContain('brakes');
    expect(pointLabel('COUPLING_DEVICES')).toBe('Coupling devices');
    expect(pointLabel('OTHER_DEFECTS')).toContain('safe operation');
  });
});
