// Equipment fuel burn tracker.
//
// Given a series of hour-meter reads + a series of fuel deliveries
// for one piece of equipment, computes gallons-per-hour over each
// fuel interval and flags outliers. Heavy-civil iron has well-known
// burn rates (Cat D6 ≈ 5 gph, 950 wheel loader ≈ 4 gph, scraper
// ≈ 10 gph). A sudden jump usually means: idling left on, a leak,
// or a stolen fuel card.
//
// Pure: no DB, no clock.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const HourMeterReadSchema = z.object({
  /** Equipment id. */
  equipmentId: z.string().min(1),
  /** Date the read was taken (yyyy-mm-dd). */
  date: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** Hour-meter value at the read (hours). Strictly increasing
   *  except on meter rollover (caller's responsibility). */
  hourMeter: z.number().nonnegative(),
});
export type HourMeterRead = z.infer<typeof HourMeterReadSchema>;

export const FuelDeliverySchema = z.object({
  equipmentId: z.string().min(1),
  date: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  gallons: z.number().nonnegative(),
  /** Optional unit price for cost rollups (cents per gallon). */
  unitPriceCentsPerGallon: z.number().int().nonnegative().optional(),
});
export type FuelDelivery = z.infer<typeof FuelDeliverySchema>;

export type BurnSeverity = 'normal' | 'high' | 'critical';

export interface BurnInterval {
  equipmentId: string;
  startDate: string;
  endDate: string;
  startHourMeter: number;
  endHourMeter: number;
  hoursWorked: number;
  gallonsBurned: number;
  /** Gallons per hour over the interval. */
  gph: number;
  costCents: number;
  severity: BurnSeverity;
}

export interface BurnReport {
  equipmentId: string;
  /** Intervals in date order. Each interval is bounded by two
   *  consecutive hour-meter reads + the fuel between them. */
  intervals: BurnInterval[];
  /** Average gph across the report (gallons / hours summed). */
  averageGph: number;
  highSeverityCount: number;
  criticalSeverityCount: number;
}

export interface BuildBurnReportInput {
  equipmentId: string;
  reads: HourMeterRead[];
  deliveries: FuelDelivery[];
  /** "Normal" upper bound for gph (default 8 — covers most rigs).
   *  Above this = 'high'. */
  highGphThreshold?: number;
  /** Above this = 'critical' (default 12). */
  criticalGphThreshold?: number;
}

const DEFAULT_HIGH = 8;
const DEFAULT_CRITICAL = 12;

export function buildFuelBurnReport(input: BuildBurnReportInput): BurnReport {
  const high = input.highGphThreshold ?? DEFAULT_HIGH;
  const critical = input.criticalGphThreshold ?? DEFAULT_CRITICAL;

  const reads = input.reads
    .filter((r) => r.equipmentId === input.equipmentId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const deliveries = input.deliveries
    .filter((d) => d.equipmentId === input.equipmentId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const intervals: BurnInterval[] = [];
  let totalHours = 0;
  let totalGallons = 0;

  for (let i = 1; i < reads.length; i++) {
    const start = reads[i - 1]!;
    const end = reads[i]!;
    if (end.hourMeter < start.hourMeter) continue; // meter rollover; skip
    const hours = end.hourMeter - start.hourMeter;
    if (hours <= 0) continue;
    const inWindow = deliveries.filter(
      (d) => d.date >= start.date && d.date < end.date,
    );
    const gallons = inWindow.reduce((s, d) => s + d.gallons, 0);
    const costCents = inWindow.reduce(
      (s, d) => s + Math.round(d.gallons * (d.unitPriceCentsPerGallon ?? 0)),
      0,
    );
    if (gallons <= 0) continue; // no fuel in window; nothing to score
    const gph = round2(gallons / hours);
    const severity: BurnSeverity =
      gph >= critical ? 'critical' : gph >= high ? 'high' : 'normal';
    intervals.push({
      equipmentId: input.equipmentId,
      startDate: start.date,
      endDate: end.date,
      startHourMeter: start.hourMeter,
      endHourMeter: end.hourMeter,
      hoursWorked: round2(hours),
      gallonsBurned: round2(gallons),
      gph,
      costCents,
      severity,
    });
    totalHours += hours;
    totalGallons += gallons;
  }

  return {
    equipmentId: input.equipmentId,
    intervals,
    averageGph: totalHours > 0 ? round2(totalGallons / totalHours) : 0,
    highSeverityCount: intervals.filter((i) => i.severity === 'high').length,
    criticalSeverityCount: intervals.filter((i) => i.severity === 'critical').length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
