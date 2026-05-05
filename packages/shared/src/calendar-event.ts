// Calendar event — generic schedule item rendered on /calendar.
//
// Plain English: meetings, bid deadlines, inspections, payroll
// cutoffs, vacation, anything that needs to land on the company
// calendar. Separate from `dispatch` (which is the daily yard-handout
// crew + equipment assignment). A dispatch is operational; a calendar
// event is informational.
//
// Stored on the API at data/calendar-events/. Web reads via
// /api/calendar-events?from=...&to=...

import { z } from 'zod';

export const CalendarEventCategorySchema = z.enum([
  'GENERAL',
  'JOB',
  'BID_DUE',
  'PAY_PERIOD',
  'INSPECTION',
  'MEETING',
  'PERSONAL',
  'TIME_OFF',
]);
export type CalendarEventCategory = z.infer<typeof CalendarEventCategorySchema>;

/** Lookup label for each category. Used by the chip render. */
export function calendarEventCategoryLabel(c: CalendarEventCategory): string {
  switch (c) {
    case 'GENERAL':
      return 'General';
    case 'JOB':
      return 'Job';
    case 'BID_DUE':
      return 'Bid due';
    case 'PAY_PERIOD':
      return 'Pay period';
    case 'INSPECTION':
      return 'Inspection';
    case 'MEETING':
      return 'Meeting';
    case 'PERSONAL':
      return 'Personal';
    case 'TIME_OFF':
      return 'Time off';
  }
}

/** Default chip background per category — used when an event has no
 *  explicit color override. Tailwind class names for the chip body. */
export function calendarEventDefaultColor(c: CalendarEventCategory): string {
  switch (c) {
    case 'GENERAL':
      return 'bg-blue-100 text-blue-800';
    case 'JOB':
      return 'bg-emerald-100 text-emerald-800';
    case 'BID_DUE':
      return 'bg-red-100 text-red-800';
    case 'PAY_PERIOD':
      return 'bg-amber-100 text-amber-800';
    case 'INSPECTION':
      return 'bg-purple-100 text-purple-800';
    case 'MEETING':
      return 'bg-sky-100 text-sky-800';
    case 'PERSONAL':
      return 'bg-gray-100 text-gray-800';
    case 'TIME_OFF':
      return 'bg-orange-100 text-orange-800';
  }
}

/** A person attached to a calendar event. Two flavors:
 *
 *  - `kind: 'USER'` — refers to a YgeUser by email. These are
 *    Ryan + Brook today; in the future, anyone with a sign-in.
 *  - `kind: 'EMPLOYEE'` — refers to an Employee row by id. Most
 *    crew members are employees without a login; they appear on
 *    events as subjects (e.g. "Joe Smith — time off this week")
 *    so the office can see who's out.
 *
 *  The two kinds can overlap: Ryan is both a USER (email) and an
 *  EMPLOYEE (employee id). The picker lets you pick either bucket.
 */
export const CalendarEventAttendeeSchema = z.object({
  kind: z.enum(['USER', 'EMPLOYEE']),
  /** For USER: lowercase email. For EMPLOYEE: the employee id. */
  ref: z.string().min(1).max(120),
  /** Display name shown on the event chip + modal. */
  name: z.string().min(1).max(200),
  /** RSVP-style response. Defaults to INVITED on add. */
  status: z
    .enum(['INVITED', 'ACCEPTED', 'DECLINED'])
    .default('INVITED'),
});
export type CalendarEventAttendee = z.infer<typeof CalendarEventAttendeeSchema>;

export const CalendarEventSchema = z.object({
  /** Stable id `cal-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  title: z.string().min(1).max(200),
  description: z.string().max(4_000).optional(),

  /** ISO datetime. For all-day events: yyyy-mm-ddT00:00:00.000Z. */
  startAt: z.string().min(1),
  /** ISO datetime. For all-day events: end-of-day OR equal to startAt
   *  for single-day events. */
  endAt: z.string().min(1),

  /** True when the event blocks the whole day (or multi-day). UI
   *  shows it in the all-day band, never in the hourly grid. */
  allDay: z.boolean().default(false),

  location: z.string().max(200).optional(),
  category: CalendarEventCategorySchema.default('GENERAL'),

  /** Optional link to a job. The detail page can deep-link. */
  jobId: z.string().max(120).optional(),

  /** Optional color override (Tailwind class string). When unset the
   *  UI falls back to calendarEventDefaultColor(category). */
  color: z.string().max(80).optional(),

  /** User who created it (best-effort; from session cookie). */
  createdByUserId: z.string().max(120).optional(),

  /** People attached to the event. Both YgeUsers (with email logins)
   *  and Employees (no login, just a record). Whoever is logged in
   *  sees this event on their calendar by default if their email is
   *  in the USER attendees list. The EMPLOYEE attendees are shown on
   *  the event card so the office can see who's involved. */
  attendees: z.array(CalendarEventAttendeeSchema).default([]),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarEventCreateSchema = CalendarEventSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CalendarEventCreate = z.infer<typeof CalendarEventCreateSchema>;

export const CalendarEventPatchSchema = CalendarEventSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
  .partial()
  .strict();
export type CalendarEventPatch = z.infer<typeof CalendarEventPatchSchema>;

export function newCalendarEventId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `cal-${hex.padStart(8, '0')}`;
}

/** Returns true if the event "belongs" to the given user — they
 *  created it, OR they're listed as a USER attendee. Email is
 *  compared case-insensitively. */
export function eventIncludesUser(
  e: Pick<CalendarEvent, 'attendees' | 'createdByUserId'>,
  userEmail: string,
): boolean {
  const norm = userEmail.trim().toLowerCase();
  if (!norm) return false;
  if (
    typeof e.createdByUserId === 'string' &&
    e.createdByUserId.toLowerCase() === norm
  ) {
    return true;
  }
  return e.attendees.some(
    (a) => a.kind === 'USER' && a.ref.toLowerCase() === norm,
  );
}

/** Returns true if event start..end overlaps the [from, to] day window
 *  (inclusive). Both args are yyyy-mm-dd strings. */
export function eventOverlapsRange(
  e: Pick<CalendarEvent, 'startAt' | 'endAt'>,
  from: string,
  to: string,
): boolean {
  const eFrom = e.startAt.slice(0, 10);
  const eTo = e.endAt.slice(0, 10);
  return eFrom <= to && eTo >= from;
}
