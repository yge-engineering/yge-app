// Daily report — what one foreman submits at end of day for one job.
//
// Phase 1 scope:
//   - date, jobId, foremanId (who submitted)
//   - weather + temp (free-form; foremen don't want a 27-option dropdown)
//   - crewOnSite: per-employee start/lunch/end + computed worked hours
//   - scopeCompleted, issues, visitors, subsOnSite, materialsConsumed: text
//   - nextDayPlan: text
//   - photoCount: placeholder until Phase 4 photo geo-tag work
//
// CA break / meal enforcement (matches our memory rule):
//   - Worked > 5 hr with NO meal break logged           = violation
//   - Worked > 10 hr with only ONE meal break logged    = violation
//   - The submit endpoint refuses the report when any of the crew rows
//     have a violation, unless the foreman explicitly waives it on the row
//     (waiver becomes a legal-defensible note attached to the row).
//
// Photos, full timecard math, and certified-payroll feed land in later
// phases; the shapes here are deliberately additive so those modules can
// extend without breaking the foreman submission flow.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

/** Weather summary — free-form because the agency doesn't care about a
 *  taxonomy and the foreman knows what they saw. */
export const WeatherSchema = z.string().max(120).optional();

/** A single hours row inside a daily report — one crew member's start /
 *  lunch / end times. Times are 'HH:MM' (24-hour) so the parser doesn't
 *  have to guess AM/PM. */
export const DailyReportCrewRowSchema = z.object({
  /** Employee id — must exist in the employees store. */
  employeeId: z.string().min(1).max(60),
  /** Time started work (HH:MM). */
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour'),
  /** Time work ended (HH:MM). */
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour'),
  /** Optional first lunch break out time (HH:MM). */
  lunchOut: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour').optional(),
  /** Optional first lunch break return time (HH:MM). */
  lunchIn: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour').optional(),
  /** Optional second meal break (only triggered above 10 worked hours under
   *  CA Wage Order 16). */
  secondMealOut: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour').optional(),
  secondMealIn: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour').optional(),
  /** Free-form per-row note. */
  note: z.string().max(500).optional(),
  /** When set, the foreman has acknowledged a meal-break violation on this
   *  row and the report can submit anyway. The text is the legal defense
   *  ("Employee waived second meal break — written waiver on file."). */
  mealBreakWaiverNote: z.string().max(500).optional(),
});
export type DailyReportCrewRow = z.infer<typeof DailyReportCrewRowSchema>;

export const DailyReportSchema = z.object({
  /** Stable id `dr-YYYY-MM-DD-<8hex>`. Includes the date so the file names
   *  sort chronologically without the index. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** ISO yyyy-mm-dd of the day being reported on. NOT createdAt — the
   *  report can be filed late. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** The job this work was performed on. */
  jobId: z.string().min(1).max(120),
  /** The foreman submitting (employee id). */
  foremanId: z.string().min(1).max(60),

  weather: WeatherSchema,
  temperatureF: z.number().int().min(-50).max(150).optional(),

  crewOnSite: z.array(DailyReportCrewRowSchema).default([]),

  /** Free-form what-got-done summary. */
  scopeCompleted: z.string().max(10_000).optional(),
  /** Equipment breakdowns, late deliveries, accidents, weather delays. */
  issues: z.string().max(10_000).optional(),
  /** Inspector / owner / sub PMs / others on site. */
  visitors: z.string().max(2_000).optional(),
  /** Subcontractors performing work that day. */
  subsOnSite: z.string().max(2_000).optional(),
  /** Materials consumed — free-form list for Phase 1; ties into AP later. */
  materialsConsumed: z.string().max(4_000).optional(),
  /** What's planned for tomorrow / next shift. */
  nextDayPlan: z.string().max(4_000).optional(),

  /** Placeholder for the Phase 4 photo geo-tagging module. */
  photoCount: z.number().int().nonnegative().default(0),

  /** True iff the foreman has hit submit. Drafts saved-but-not-submitted
   *  show in the list but don't roll into reporting. */
  submitted: z.boolean().default(false),
});
export type DailyReport = z.infer<typeof DailyReportSchema>;

export const DailyReportCreateSchema = DailyReportSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  crewOnSite: z.array(DailyReportCrewRowSchema).optional(),
  photoCount: z.number().int().nonnegative().optional(),
  submitted: z.boolean().optional(),
});
export type DailyReportCreate = z.infer<typeof DailyReportCreateSchema>;

export const DailyReportPatchSchema = DailyReportCreateSchema.partial();
export type DailyReportPatch = z.infer<typeof DailyReportPatchSchema>;

// ---- Time math + CA enforcement -----------------------------------------

const HOUR_MINUTES = 60;

/** Parse HH:MM (24-hour) to minutes-from-midnight. Returns null on garbage. */
export function parseHHMM(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * HOUR_MINUTES + min;
}

/** Total worked minutes for one crew row. Subtracts both meal breaks when
 *  they're populated. Returns 0 on malformed times so the renderer always
 *  has a number. */
export function crewRowWorkedMinutes(row: DailyReportCrewRow): number {
  const start = parseHHMM(row.startTime);
  const end = parseHHMM(row.endTime);
  if (start === null || end === null) return 0;
  let total = end - start;
  if (total < 0) total += 24 * HOUR_MINUTES; // shift crossing midnight
  const lunchOut = parseHHMM(row.lunchOut ?? null);
  const lunchIn = parseHHMM(row.lunchIn ?? null);
  if (lunchOut !== null && lunchIn !== null && lunchIn > lunchOut) {
    total -= lunchIn - lunchOut;
  }
  const m2Out = parseHHMM(row.secondMealOut ?? null);
  const m2In = parseHHMM(row.secondMealIn ?? null);
  if (m2Out !== null && m2In !== null && m2In > m2Out) {
    total -= m2In - m2Out;
  }
  return Math.max(0, total);
}

/** Decimal hours rounded to two places — what shows on the report row. */
export function crewRowWorkedHours(row: DailyReportCrewRow): number {
  return Math.round((crewRowWorkedMinutes(row) / HOUR_MINUTES) * 100) / 100;
}

export type MealBreakViolation =
  | { kind: 'first-meal-missing'; workedHours: number }
  | { kind: 'second-meal-missing'; workedHours: number };

/** Returns the list of meal-break violations on this crew row.
 *  Empty array = clean.
 *  CA Labor Code 512:
 *    - shift > 5 hrs needs a 30-min meal break (waivable if shift <= 6 hrs)
 *    - shift > 10 hrs needs a SECOND 30-min meal break (waivable if shift <= 12 hrs and first was taken) */
export function crewRowViolations(row: DailyReportCrewRow): MealBreakViolation[] {
  const minutes = crewRowWorkedMinutes(row);
  const hours = minutes / HOUR_MINUTES;
  const lunchOut = parseHHMM(row.lunchOut ?? null);
  const lunchIn = parseHHMM(row.lunchIn ?? null);
  const m2Out = parseHHMM(row.secondMealOut ?? null);
  const m2In = parseHHMM(row.secondMealIn ?? null);
  const hasFirst = lunchOut !== null && lunchIn !== null && lunchIn - lunchOut >= 30;
  const hasSecond = m2Out !== null && m2In !== null && m2In - m2Out >= 30;
  const out: MealBreakViolation[] = [];
  // Strictly > 5 hours triggers first meal requirement.
  if (hours > 5 && !hasFirst) {
    out.push({ kind: 'first-meal-missing', workedHours: hours });
  }
  if (hours > 10 && !hasSecond) {
    out.push({ kind: 'second-meal-missing', workedHours: hours });
  }
  return out;
}

/** Whole-report rollup — every row's violations grouped by row. The submit
 *  endpoint uses this; the editor uses this to render warnings inline. */
export function reportViolations(
  report: Pick<DailyReport, 'crewOnSite'>,
): Array<{ row: DailyReportCrewRow; violations: MealBreakViolation[] }> {
  return report.crewOnSite
    .map((row) => ({ row, violations: crewRowViolations(row) }))
    .filter((x) => x.violations.length > 0)
    .filter((x) => {
      // Drop rows where the foreman has explicitly waived. We treat the
      // waiver as covering all violations on the row — Phase 1 keeps this
      // coarse. Future work can split per-violation waivers.
      return !x.row.mealBreakWaiverNote;
    });
}

/** Sum of all worked hours on the report — what the daily totals card
 *  shows above the crew table. */
export function totalReportHours(
  report: Pick<DailyReport, 'crewOnSite'>,
): number {
  let minutes = 0;
  for (const row of report.crewOnSite) minutes += crewRowWorkedMinutes(row);
  return Math.round((minutes / HOUR_MINUTES) * 100) / 100;
}

// ---- Display helpers + id ------------------------------------------------

/** Stable id `dr-YYYY-MM-DD-<8hex>`. Date in the id makes the file names
 *  chronologically sortable without scanning the JSON. */
export function newDailyReportId(date: string): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `dr-${date}-${hex.padStart(8, '0')}`;
}

export function violationLabel(v: MealBreakViolation, locale: Locale = 'en'): string {
  const key = v.kind === 'first-meal-missing'
    ? 'mealBreak.firstMissing'
    : 'mealBreak.secondMissing';
  return translate(SEED_DICTIONARY, locale, key, { hours: v.workedHours.toFixed(2) });
}
