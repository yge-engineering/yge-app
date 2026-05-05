// Minimal iCalendar (RFC 5545) serializer.
//
// Plain English: turn a list of CalendarEvent rows into an `.ics`
// blob that Outlook, Google Calendar, Apple Calendar, and any other
// CalDAV client can subscribe to. Read-only — clients pull, we push
// nothing back.
//
// Why hand-rolled: the existing npm options (ical-generator, ics)
// pull in heavy deps and fight TS types. iCalendar is a flat text
// format; ~80 lines covers what we need (basic VEVENT with
// title/start/end/all-day/location/description/UID).

import type { CalendarEvent } from '@yge/shared';

const PRODID = '-//YGE//Calendar//EN';

/** Escape special chars per RFC 5545 §3.3.11. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold a content line to <=75 octets per RFC 5545 §3.1. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const end = Math.min(i + 75, line.length);
    out.push((i === 0 ? '' : ' ') + line.slice(i, end));
    i = end;
  }
  return out.join('\r\n');
}

function utcStamp(iso: string): string {
  // iCalendar UTC datetime: yyyymmddTHHMMSSZ
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function dateOnly(iso: string): string {
  // iCalendar VALUE=DATE: yyyymmdd
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function eventBlock(e: CalendarEvent, host: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT'];
  lines.push(`UID:${e.id}@${host}`);
  lines.push(`DTSTAMP:${utcStamp(e.updatedAt)}`);
  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.startAt)}`);
    // For all-day events, RFC 5545 wants an exclusive end date.
    // Add one day to endAt's date so a single-day event renders correctly.
    const end = new Date(e.endAt);
    end.setUTCDate(end.getUTCDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${dateOnly(end.toISOString())}`);
  } else {
    lines.push(`DTSTART:${utcStamp(e.startAt)}`);
    lines.push(`DTEND:${utcStamp(e.endAt)}`);
  }
  lines.push(`SUMMARY:${escapeText(e.title)}`);
  if (e.description) {
    lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  }
  if (e.location) {
    lines.push(`LOCATION:${escapeText(e.location)}`);
  }
  // Attendees: iCalendar wants ORGANIZER / ATTENDEE with a CN param.
  // We have email-style refs for USERs only; EMPLOYEEs become a note
  // in the description rather than attendees so the feed doesn't
  // generate fake mailto URIs.
  for (const a of e.attendees) {
    if (a.kind === 'USER') {
      lines.push(
        `ATTENDEE;CN=${escapeText(a.name)};PARTSTAT=${a.status};RSVP=FALSE:mailto:${a.ref}`,
      );
    }
  }
  if (e.createdByUserId) {
    lines.push(`ORGANIZER;CN=YGE:mailto:${e.createdByUserId}`);
  }
  // Tag the category for clients that surface it.
  lines.push(`CATEGORIES:${escapeText(e.category)}`);
  lines.push('END:VEVENT');
  return lines.map(fold);
}

/** Serialize a list of CalendarEvents to an .ics blob. `host` is the
 *  domain string used for UIDs (any FQDN — doesn't have to be
 *  reachable). */
export function eventsToIcal(events: CalendarEvent[], host: string, calendarName: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(...eventBlock(e, host));
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
