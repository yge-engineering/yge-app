// Weather log — per-day per-job weather record.
//
// Construction contracts almost always include weather as an
// excusable delay condition. Documenting daily weather (and hours
// lost to it) is the foundation for time-extension requests under
// CA Greenbook §6-1.06, Caltrans Std. Spec. §8-1.07, and most
// federal/agency contracts.
//
// CA Labor Code + Title 8 §3395 ("Heat illness prevention in
// outdoor places of employment") imposes additional duties when
// outdoor temperature meets or exceeds 80°F (acclimatization,
// shade, water) and HIGH-HEAT procedures at 95°F (mandatory rest,
// observer, pre-shift meeting, etc.). The weather log helps prove
// those triggers were watched + acted on.
//
// Phase 1 captures the data; Phase 2 will pull NOAA data
// automatically and pre-fill the row.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const WeatherConditionSchema = z.enum([
  'CLEAR',
  'PARTLY_CLOUDY',
  'OVERCAST',
  'LIGHT_RAIN',
  'HEAVY_RAIN',
  'SNOW',
  'FOG',
  'WIND',
  'EXTREME_HEAT',
  'EXTREME_COLD',
  'OTHER',
]);
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

export const WeatherImpactSchema = z.enum([
  'NONE',
  'PARTIAL',     // some crews / scopes lost time; others worked through
  'STOPPED',     // full job shutdown for some/all of the day
]);
export type WeatherImpact = z.infer<typeof WeatherImpactSchema>;

export const WeatherLogSchema = z.object({
  /** Stable id `wx-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** Date of observation (yyyy-mm-dd). */
  observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),

  /** Optional location free-form (jobsite, station). Falls back to job. */
  location: z.string().max(200).optional(),

  /** Temperature observations. Stored as integer °F to keep math simple
   *  and avoid float comparisons in the §3395 heat-illness gate. */
  highF: z.number().int().min(-100).max(150).optional(),
  lowF: z.number().int().min(-100).max(150).optional(),
  /** Precipitation in hundredths of an inch (e.g. 25 = 0.25 in.) — int
   *  to avoid float weirdness. */
  precipHundredthsInch: z.number().int().nonnegative().optional(),
  /** Sustained wind speed mph. */
  windMph: z.number().int().nonnegative().max(200).optional(),
  /** Peak / gust wind speed mph. */
  gustMph: z.number().int().nonnegative().max(200).optional(),

  primaryCondition: WeatherConditionSchema.default('CLEAR'),
  /** Free-form notes on the day (sky, ground, AM vs PM split). */
  notes: z.string().max(10_000).optional(),

  impact: WeatherImpactSchema.default('NONE'),
  /** Hours of work lost across all crews to weather. Used in delay
   *  claims. */
  lostHours: z.number().nonnegative().default(0),
  /** True if heat-illness procedures were activated per T8 §3395. */
  heatProceduresActivated: z.boolean().default(false),
  /** True if HIGH-HEAT procedures (>= 95°F) were activated. */
  highHeatProceduresActivated: z.boolean().default(false),

  /** Recorder / source. */
  recordedByName: z.string().max(120).optional(),
  /** "MANUAL", "NOAA", "WEATHER_STATION_API", etc. */
  source: z.string().max(40).optional(),
});
export type WeatherLog = z.infer<typeof WeatherLogSchema>;

export const WeatherLogCreateSchema = WeatherLogSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  primaryCondition: WeatherConditionSchema.optional(),
  impact: WeatherImpactSchema.optional(),
  lostHours: z.number().nonnegative().optional(),
  heatProceduresActivated: z.boolean().optional(),
  highHeatProceduresActivated: z.boolean().optional(),
});
export type WeatherLogCreate = z.infer<typeof WeatherLogCreateSchema>;

export const WeatherLogPatchSchema = WeatherLogCreateSchema.partial();
export type WeatherLogPatch = z.infer<typeof WeatherLogPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function weatherConditionLabel(c: WeatherCondition, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `weather.condition.${c}`);
}

export function weatherImpactLabel(i: WeatherImpact, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `weather.impact.${i}`);
}

/** Heat-illness threshold per T8 §3395(d) — outdoor temp ≥ 80°F triggers
 *  base procedures. */
export const HEAT_THRESHOLD_F = 80;
/** High-heat threshold per T8 §3395(e) — outdoor temp ≥ 95°F triggers
 *  high-heat procedures. */
export const HIGH_HEAT_THRESHOLD_F = 95;

/** True iff the day's high triggers §3395 base heat-illness procedures
 *  (water, shade, training, acclimatization, emergency response). */
export function shouldActivateHeatProcedures(
  log: Pick<WeatherLog, 'highF'>,
): boolean {
  if (log.highF == null) return false;
  return log.highF >= HEAT_THRESHOLD_F;
}

/** True iff the day's high triggers §3395 HIGH-HEAT procedures
 *  (mandatory rest, observer, pre-shift meeting, etc.). */
export function shouldActivateHighHeatProcedures(
  log: Pick<WeatherLog, 'highF'>,
): boolean {
  if (log.highF == null) return false;
  return log.highF >= HIGH_HEAT_THRESHOLD_F;
}

/**
 * Compliance check: a log row is OK if heat procedures are activated
 * whenever they should be. Returns the missing flags.
 */
export function heatComplianceGap(log: WeatherLog): {
  missingHeatActivation: boolean;
  missingHighHeatActivation: boolean;
} {
  return {
    missingHeatActivation:
      shouldActivateHeatProcedures(log) && !log.heatProceduresActivated,
    missingHighHeatActivation:
      shouldActivateHighHeatProcedures(log) && !log.highHeatProceduresActivated,
  };
}

export interface WeatherLogRollup {
  total: number;
  /** Total hours lost across all logs in the set. */
  totalLostHours: number;
  /** Days with weather impact > NONE. */
  impactedDays: number;
  /** Days that should have triggered heat procedures. */
  heatTriggerDays: number;
  /** Days that should have triggered HIGH-HEAT procedures. */
  highHeatTriggerDays: number;
  /** Days that triggered procedures but procedures weren't activated. */
  heatComplianceGaps: number;
}

export function computeWeatherLogRollup(logs: WeatherLog[]): WeatherLogRollup {
  let totalLostHours = 0;
  let impactedDays = 0;
  let heatTriggerDays = 0;
  let highHeatTriggerDays = 0;
  let heatComplianceGaps = 0;
  for (const log of logs) {
    totalLostHours += log.lostHours;
    if (log.impact !== 'NONE') impactedDays += 1;
    if (shouldActivateHeatProcedures(log)) heatTriggerDays += 1;
    if (shouldActivateHighHeatProcedures(log)) highHeatTriggerDays += 1;
    const gap = heatComplianceGap(log);
    if (gap.missingHeatActivation || gap.missingHighHeatActivation) {
      heatComplianceGaps += 1;
    }
  }
  return {
    total: logs.length,
    totalLostHours,
    impactedDays,
    heatTriggerDays,
    highHeatTriggerDays,
    heatComplianceGaps,
  };
}

export function newWeatherLogId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `wx-${hex.padStart(8, '0')}`;
}
