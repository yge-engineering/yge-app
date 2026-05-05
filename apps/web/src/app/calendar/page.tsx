// /calendar — full-feature calendar with day/week/month/year views.
//
// Plain English: this is the YGE company calendar. Pick a view, click
// a day to add an event, click an event to edit it. Events can have
// attendees — picked from the seeded users (Ryan, Brook) and the
// employee roster — so the office can tag who's involved. Each
// signed-in user gets a personal default view (events they own or
// were invited to) with a toggle to see everything.
//
// Independent of /dispatch (which is the operational yard handout —
// crew + equipment for the day).

import type { CalendarEvent, Employee } from '@yge/shared';

import { AppShell } from '../../components';
import { getCurrentUser } from '../../lib/auth';
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

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/employees`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { employees?: Employee[] };
    return body.employees ?? [];
  } catch {
    return [];
  }
}

// Mirror of the seeded-user list in apps/web/src/lib/auth.ts. The
// calendar attendee picker exposes both as USER attendees (matched on
// email).
const KNOWN_USERS: Array<{ email: string; name: string }> = [
  { email: 'brookyoung@youngge.com', name: 'Brook L Young' },
  { email: 'ryoung@youngge.com', name: 'Ryan D Young' },
];

export default async function CalendarPage() {
  const [events, employees] = await Promise.all([
    fetchEvents(),
    fetchEmployees(),
  ]);
  const user = getCurrentUser();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <CalendarView
          initialEvents={events}
          today={today}
          apiBaseUrl={publicApiBaseUrl()}
          employees={employees}
          knownUsers={KNOWN_USERS}
          currentUserEmail={user?.email ?? ''}
        />
      </main>
    </AppShell>
  );
}
