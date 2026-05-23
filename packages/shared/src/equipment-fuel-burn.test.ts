import { describe, it, expect } from 'vitest';
import {
  buildFuelBurnReport,
  type FuelDelivery,
  type HourMeterRead,
} from './equipment-fuel-burn';

describe('buildFuelBurnReport — happy path', () => {
  it('computes gph over each interval', () => {
    const reads: HourMeterRead[] = [
      { equipmentId: 'eq-1', date: '2026-05-01', hourMeter: 1000 },
      { equipmentId: 'eq-1', date: '2026-05-08', hourMeter: 1050 }, // 50h
      { equipmentId: 'eq-1', date: '2026-05-15', hourMeter: 1110 }, // 60h
    ];
    const deliveries: FuelDelivery[] = [
      { equipmentId: 'eq-1', date: '2026-05-03', gallons: 200, unitPriceCentsPerGallon: 4_50 },
      { equipmentId: 'eq-1', date: '2026-05-10', gallons: 300 },
    ];
    const r = buildFuelBurnReport({
      equipmentId: 'eq-1',
      reads,
      deliveries,
    });
    expect(r.intervals).toHaveLength(2);
    expect(r.intervals[0]!.gph).toBe(4); // 200 / 50
    expect(r.intervals[1]!.gph).toBe(5); // 300 / 60
    expect(r.averageGph).toBe(round2(500 / 110));
    expect(r.intervals[0]!.costCents).toBe(200 * 4_50);
  });
});

describe('buildFuelBurnReport — severity flags', () => {
  it('flags >= 8 gph as high', () => {
    const reads: HourMeterRead[] = [
      { equipmentId: 'eq-1', date: '2026-05-01', hourMeter: 0 },
      { equipmentId: 'eq-1', date: '2026-05-08', hourMeter: 10 },
    ];
    const deliveries: FuelDelivery[] = [
      { equipmentId: 'eq-1', date: '2026-05-05', gallons: 90 }, // 9 gph
    ];
    const r = buildFuelBurnReport({ equipmentId: 'eq-1', reads, deliveries });
    expect(r.intervals[0]!.severity).toBe('high');
    expect(r.highSeverityCount).toBe(1);
  });

  it('flags >= 12 gph as critical', () => {
    const reads: HourMeterRead[] = [
      { equipmentId: 'eq-1', date: '2026-05-01', hourMeter: 0 },
      { equipmentId: 'eq-1', date: '2026-05-08', hourMeter: 10 },
    ];
    const deliveries: FuelDelivery[] = [
      { equipmentId: 'eq-1', date: '2026-05-05', gallons: 130 }, // 13 gph
    ];
    const r = buildFuelBurnReport({ equipmentId: 'eq-1', reads, deliveries });
    expect(r.intervals[0]!.severity).toBe('critical');
    expect(r.criticalSeverityCount).toBe(1);
  });

  it('thresholds are configurable', () => {
    const reads: HourMeterRead[] = [
      { equipmentId: 'eq-1', date: '2026-05-01', hourMeter: 0 },
      { equipmentId: 'eq-1', date: '2026-05-08', hourMeter: 10 },
    ];
    const deliveries: FuelDelivery[] = [
      { equipmentId: 'eq-1', date: '2026-05-05', gallons: 50 }, // 5 gph
    ];
    const r = buildFuelBurnReport({
      equipmentId: 'eq-1',
      reads,
      deliveries,
      highGphThreshold: 4,
    });
    expect(r.intervals[0]!.severity).toBe('high');
  });
});

describe('buildFuelBurnReport — defensive', () => {
  it('filters to the requested equipment only', () => {
    const reads: HourMeterRead[] = [
      { equipmentId: 'eq-1', date: '2026-05-01', hourMeter: 0 },
      { equipmentId: 'eq-1', date: '2026-05-08', hourMeter: 50 },
      { equipmentId: 'eq-2', date: '2026-05-01', hourMeter: 0 },
      { equipmentId: 'eq-2', date: '2026-05-08', hourMeter: 50 },
    ];
    const deliveries: FuelDelivery[] = [
      { equipmentId: 'eq-1', date: '2026-05-05', gallons: 100 },
      { equipmentId: 'eq-2', date: '2026-05-05', gallons: 999 },
    ];
    const r = buildFuelBurnReport({ equipmentId: 'eq-1', reads, deliveries });
    expect(r.intervals[0]!.gallonsBurned).toBe(100);
  });

  it('skips intervals with meter rollback', () => {
    const reads: HourMeterRead[] = [
      { equipmentId: 'eq-1', date: '2026-05-01', hourMeter: 1000 },
      { equipmentId: 'eq-1', date: '2026-05-08', hourMeter: 0 }, // rolled back
      { equipmentId: 'eq-1', date: '2026-05-15', hourMeter: 50 },
    ];
    const deliveries: FuelDelivery[] = [
      { equipmentId: 'eq-1', date: '2026-05-09', gallons: 100 },
    ];
    const r = buildFuelBurnReport({ equipmentId: 'eq-1', reads, deliveries });
    // First interval skipped (rollback). Second interval included.
    expect(r.intervals).toHaveLength(1);
    expect(r.intervals[0]!.startDate).toBe('2026-05-08');
  });

  it('returns empty when no reads or no deliveries in window', () => {
    expect(
      buildFuelBurnReport({ equipmentId: 'eq-1', reads: [], deliveries: [] }).intervals,
    ).toEqual([]);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
