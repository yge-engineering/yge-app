// /calendar — full-feature calendar with day/week/month/year views.
//
// Plain English: this is the YGE company calendar. Pick a view, click
// a day to add an event, click an event to edit it. Independent of
// the dispatch board (which is operational — crew + equipment for
// the day). The calendar holds meetings, bid deadlines, payroll
// cutoffs, vacation, anything that needs to land on a date.

import type { CalendarEvent } from '@yge/shared';

import { AppShell } from '../../components';
import { CalendarView } from './calendar-view';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEvents(): Promise<CalendarEvent[]> {
  // Fetch a wide window — 3 months back to 12 months forward — once
  // on first render. The CalendarView re-fetches client-side when
  // the user pages outside that window.
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 3);
  const to = new Date(now);
  to.setMonth(to.getMonth() + 12);
  const url =
    `${apiBaseUrl()}/api/calendar-events?` +
    new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }).toString();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { events?: CalendarEvent[] };
    return body.events ?? [];
  } catch {
    return [];
  }
}

export default async function CalendarPage() {
  const events = await fetchEvents();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <CalendarView
          initialEvents={events}
          today={today}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </main>
    </AppShell>
  );
}
