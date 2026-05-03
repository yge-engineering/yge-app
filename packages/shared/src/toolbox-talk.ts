// Toolbox talk — Cal/OSHA T8 §1509 weekly tailgate safety meeting record.
//
// California Code of Regulations, Title 8 §1509 (Construction Safety
// Orders) requires every employer with 10+ employees in any one
// trade to hold a tailgate / toolbox safety meeting at least every
// 10 working days. The record must show:
//   - date
//   - topic discussed
//   - attendees (names + initials/signature)
//   - meeting leader
//
// Records are subject to inspection by the Division of Occupational
// Safety and Health (Cal/OSHA). Phase 1 stores the record + the data
// needed to print a paper sign-in sheet for in-person signatures.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const ToolboxTalkStatusSchema = z.enum([
  'DRAFT',
  'HELD',
  'SUBMITTED',
]);
export type ToolboxTalkStatus = z.infer<typeof ToolboxTalkStatusSchema>;

export const ToolboxTalkAttendeeSchema = z.object({
  /** Employee id (emp-<8hex>) if it's a YGE employee, free-form for
   *  visitors / subs. */
  employeeId: z.string().max(120).optional(),
  /** Printed name. Required. */
  name: z.string().min(1).max(120),
  /** Free-form initials shown on the sign-in sheet (some crews sign
   *  initials only). */
  initials: z.string().max(10).optional(),
  /** Crew classification — copied from the employee record at log time. */
  classification: z.string().max(80).optional(),
  /** Whether the attendee actually signed the paper sheet. */
  signed: z.boolean().default(false),
});
export type ToolboxTalkAttendee = z.infer<typeof ToolboxTalkAttendeeSchema>;

export const ToolboxTalkSchema = z.object({
  /** Stable id `tbt-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Date the meeting was held (yyyy-mm-dd). */
  heldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Optional job association. */
  jobId: z.string().max(120).optional(),
  /** Free-form location (the yard, jobsite station, etc.). */
  location: z.string().max(200).optional(),

  /** Short topic — required for inspector record. */
  topic: z.string().min(1).max(200),
  /** Detailed talking points / agenda. */
  body: z.string().max(20_000).optional(),

  /** Who led the meeting. */
  leaderName: z.string().min(1).max(120),
  /** Leader's title (e.g. "Foreman", "Safety Director"). */
  leaderTitle: z.string().max(80).optional(),

  attendees: z.array(ToolboxTalkAttendeeSchema).default([]),

  status: ToolboxTalkStatusSchema.default('DRAFT'),

  /** Date the signed sheet was submitted to Ryan / safety director. */
  submittedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Free-form notes — incidents, follow-ups, near-misses discussed. */
  notes: z.string().max(10_000).optional(),
});
export type ToolboxTalk = z.infer<typeof ToolboxTalkSchema>;

export const ToolboxTalkCreateSchema = ToolboxTalkSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: ToolboxTalkStatusSchema.optional(),
  attendees: z.array(ToolboxTalkAttendeeSchema).optional(),
});
export type ToolboxTalkCreate = z.infer<typeof ToolboxTalkCreateSchema>;

export const ToolboxTalkPatchSchema = ToolboxTalkCreateSchema.partial();
export type ToolboxTalkPatch = z.infer<typeof ToolboxTalkPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function toolboxTalkStatusLabel(s: ToolboxTalkStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `toolboxTalk.status.${s}`);
}

/** Count attendees who signed the sheet. */
export function signedAttendeeCount(t: Pick<ToolboxTalk, 'attendees'>): number {
  return t.attendees.filter((a) => a.signed).length;
}

/**
 * Cal/OSHA §1509 requires meetings at least every 10 working days.
 * Given a list of meeting dates and a date to check (defaults to
 * today), returns:
 *   - daysSinceLast: working days since the most recent meeting, or
 *     null if no prior meeting.
 *   - overdue: true iff daysSinceLast > 10.
 *
 * "Working days" here is calendar days minus weekends — we don't
 * model state holidays. The 10-day cadence is a floor; in practice
 * YGE holds them weekly.
 */
export function workingDaysSinceLastTalk(
  heldDates: string[],
  asOf: Date = new Date(),
): { daysSinceLast: number | null; overdue: boolean; lastHeldOn: string | null } {
  if (heldDates.length === 0) {
    return { daysSinceLast: null, overdue: true, lastHeldOn: null };
  }
  const sorted = [...heldDates].sort();
  const lastHeldOn = sorted[sorted.length - 1] ?? null;
  if (!lastHeldOn) return { daysSinceLast: null, overdue: true, lastHeldOn: null };
  const last = new Date(lastHeldOn + 'T00:00:00');
  const msPerDay = 24 * 60 * 60 * 1000;
  let workingDays = 0;
  for (let d = new Date(last.getTime() + msPerDay); d <= asOf; d = new Date(d.getTime() + msPerDay)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) workingDays += 1;
  }
  return {
    daysSinceLast: workingDays,
    overdue: workingDays > 10,
    lastHeldOn,
  };
}

export interface ToolboxTalkRollup {
  total: number;
  draft: number;
  held: number;
  submitted: number;
  /** Most recent meeting date. */
  lastHeldOn: string | null;
  /** Working days since last meeting. */
  daysSinceLast: number | null;
  /** True if past the §1509 10-working-day deadline. */
  overdue: boolean;
}

export function computeToolboxTalkRollup(
  talks: ToolboxTalk[],
  asOf: Date = new Date(),
): ToolboxTalkRollup {
  let draft = 0;
  let held = 0;
  let submitted = 0;
  for (const t of talks) {
    if (t.status === 'DRAFT') draft += 1;
    else if (t.status === 'HELD') held += 1;
    else if (t.status === 'SUBMITTED') submitted += 1;
  }
  const recordedDates = talks
    .filter((t) => t.status !== 'DRAFT')
    .map((t) => t.heldOn);
  const cadence = workingDaysSinceLastTalk(recordedDates, asOf);
  return {
    total: talks.length,
    draft,
    held,
    submitted,
    lastHeldOn: cadence.lastHeldOn,
    daysSinceLast: cadence.daysSinceLast,
    overdue: cadence.overdue,
  };
}

export function newToolboxTalkId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `tbt-${hex.padStart(8, '0')}`;
}
