// Time card — per-employee weekly hours per job.
//
// Phase 1 scope: weekly time cards (Mon-Sun). One card per (employee,
// week-starting-Monday). Each card has 0..N day entries; each day has
// 0..N job-row entries (an employee can split their day across jobs).
//
// CA labor enforcement reuses the same meal-break rules from daily
// reports. Time card entries that come *from* a submitted daily report
// pre-populate the card (sourceDailyReportId) so the foreman's daily
// report is the canonical source for hours; the time card is the
// per-employee weekly rollup that goes to payroll.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const TimeCardStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'POSTED',           // pushed to payroll run
  'REJECTED',
]);
export type TimeCardStatus = z.infer<typeof TimeCardStatusSchema>;

/** A single time entry on a single day. Multiple per day allowed when
 *  the employee splits between jobs. */
export const TimeEntrySchema = z.object({
  /** ISO yyyy-mm-dd. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  jobId: z.string().min(1).max(120),
  /** HH:MM 24-hour. */
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour'),
  lunchOut: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour').optional(),
  lunchIn: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM 24-hour').optional(),
  /** Cost code from the estimate (free-form Phase 1). */
  costCode: z.string().max(40).optional(),
  /** When this entry was auto-pulled from a foreman's daily report. */
  sourceDailyReportId: z.string().max(120).optional(),
  /** Free-form note. */
  note: z.string().max(500).optional(),
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export const TimeCardSchema = z.object({
  /** Stable id `tc-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  employeeId: z.string().min(1).max(60),
  /** Monday of the week (yyyy-mm-dd). Combined with employeeId this
   *  uniquely identifies the card. */
  weekStarting: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),

  entries: z.array(TimeEntrySchema).default([]),
  status: TimeCardStatusSchema.default('DRAFT'),

  submittedAt: z.string().optional(),
  approvedAt: z.string().optional(),
  approvedByEmployeeId: z.string().max(60).optional(),
  rejectedReason: z.string().max(2_000).optional(),

  /** Free-form note from the employee. */
  notes: z.string().max(4_000).optional(),
});
export type TimeCard = z.infer<typeof TimeCardSchema>;

export const TimeCardCreateSchema = TimeCardSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: TimeCardStatusSchema.optional(),
  entries: z.array(TimeEntrySchema).optional(),
});
export type TimeCardCreate = z.infer<typeof TimeCardCreateSchema>;

export const TimeCardPatchSchema = TimeCardCreateSchema.partial();
export type TimeCardPatch = z.infer<typeof TimeCardPatchSchema>;

// ---- Pure helpers --------------------------------------------------------

const HOUR_MINUTES = 60;

function parseHHMM(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * HOUR_MINUTES + min;
}

/** Worked minutes for one entry (subtracts lunch when populated). */
export function entryWorkedMinutes(entry: TimeEntry): number {
  const start = parseHHMM(entry.startTime);
  const end = parseHHMM(entry.endTime);
  if (start === null || end === null) return 0;
  let total = end - start;
  if (total < 0) total += 24 * HOUR_MINUTES; // shift across midnight
  const lo = parseHHMM(entry.lunchOut ?? null);
  const li = parseHHMM(entry.lunchIn ?? null);
  if (lo !== null && li !== null && li > lo) total -= li - lo;
  return Math.max(0, total);
}

export function entryWorkedHours(entry: TimeEntry): number {
  return Math.round((entryWorkedMinutes(entry) / HOUR_MINUTES) * 100) / 100;
}

/** Sum of worked hours across all entries. */
export function totalCardHours(card: Pick<TimeCard, 'entries'>): number {
  let minutes = 0;
  for (const e of card.entries) minutes += entryWorkedMinutes(e);
  return Math.round((minutes / HOUR_MINUTES) * 100) / 100;
}

/** Hours by job for the week. Drives the payroll allocation table. */
export function hoursByJob(card: Pick<TimeCard, 'entries'>): Array<{ jobId: string; hours: number }> {
  const m = new Map<string, number>();
  for (const e of card.entries) {
    m.set(e.jobId, (m.get(e.jobId) ?? 0) + entryWorkedMinutes(e));
  }
  return Array.from(m.entries()).map(([jobId, minutes]) => ({
    jobId,
    hours: Math.round((minutes / HOUR_MINUTES) * 100) / 100,
  }));
}

/** Hours by date — for the daily breakdown. */
export function hoursByDate(card: Pick<TimeCard, 'entries'>): Array<{ date: string; hours: number }> {
  const m = new Map<string, number>();
  for (const e of card.entries) {
    m.set(e.date, (m.get(e.date) ?? 0) + entryWorkedMinutes(e));
  }
  return Array.from(m.entries())
    .map(([date, minutes]) => ({
      date,
      hours: Math.round((minutes / HOUR_MINUTES) * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Whether the card has any over-40 (overtime) hours. CA goes by daily
 *  >8 hour OT first, with weekly >40 as the secondary threshold. */
export function overtimeHoursThisWeek(card: Pick<TimeCard, 'entries'>): {
  dailyOvertimeHours: number;
  weeklyOvertimeHours: number;
} {
  let dailyOT = 0;
  for (const { hours } of hoursByDate(card)) {
    if (hours > 8) dailyOT += hours - 8;
  }
  const total = totalCardHours(card);
  const regularCap = 40;
  const weeklyOT = Math.max(0, total - regularCap - dailyOT);
  return {
    dailyOvertimeHours: Math.round(dailyOT * 100) / 100,
    weeklyOvertimeHours: Math.round(weeklyOT * 100) / 100,
  };
}

export function timeCardStatusLabel(s: TimeCardStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `timeCard.status.${s}`);
}

export function newTimeCardId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `tc-${hex.padStart(8, '0')}`;
}

/** Compute the Monday of the week for a given yyyy-mm-dd. */
export function mondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  const dow = d.getDay(); // 0 = Sunday, 1 = Monday
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
