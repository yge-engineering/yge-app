// /calendar — 14-day dispatch board.
//
// Plain English: groups dispatches by day so you can see at a glance
// who's working where over the next two weeks. Past days collapse,
// today highlights, future days show a count + foreman list.

import Link from 'next/link';

import { AppShell, Card, EmptyState, PageHeader, StatusPill } from '../../components';
import type { Dispatch } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchDispatches(): Promise<Dispatch[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/dispatches`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body.dispatches;
    return Array.isArray(arr) ? (arr as Dispatch[]) : [];
  } catch {
    return [];
  }
}

function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Today';
  const d = new Date(`${iso}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  const ms = d.getTime() - t.getTime();
  const days = Math.round(ms / 86_400_000);
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function statusTone(s: string): 'success' | 'info' | 'muted' | 'neutral' {
  switch (s) {
    case 'COMPLETED': return 'success';
    case 'POSTED': return 'info';
    case 'CANCELLED': return 'muted';
    default: return 'neutral';
  }
}

export default async function CalendarPage() {
  const dispatches = await fetchDispatches();
  const today = new Date().toISOString().slice(0, 10);

  // Build a 14-day window centered on today (3 past + today + 10 future).
  const days: string[] = [];
  for (let offset = -3; offset <= 10; offset += 1) {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + offset);
    days.push(d.toISOString().slice(0, 10));
  }

  // Group dispatches by scheduledFor.
  const byDay = new Map<string, Dispatch[]>();
  for (const d of dispatches) {
    const arr = byDay.get(d.scheduledFor) ?? [];
    arr.push(d);
    byDay.set(d.scheduledFor, arr);
  }

  const totalInWindow = days.reduce((sum, d) => sum + (byDay.get(d)?.length ?? 0), 0);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Calendar"
          subtitle={`${totalInWindow} dispatches across the 14-day window. Past 3 days at top, then today, then the next 10.`}
        />

        {dispatches.length === 0 ? (
          <EmptyState
            title="No dispatches"
            body="Once you start posting daily dispatches, they'll show up here grouped by day."
            actions={[{ href: '/dispatch/new', label: 'Post a dispatch', primary: true }]}
          />
        ) : (
          <div className="space-y-3">
            {days.map((iso) => {
              const list = byDay.get(iso) ?? [];
              const isToday = iso === today;
              return (
                <Card key={iso} className={isToday ? 'border-blue-500 bg-blue-50/40' : ''}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <div className={`text-sm font-semibold ${isToday ? 'text-blue-900' : 'text-gray-900'}`}>
                        {dayLabel(iso, today)}
                      </div>
                      <div className="text-[11px] uppercase tracking-wider text-gray-500">{iso}</div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {list.length === 0 ? <span className="text-gray-400">no dispatches</span> : `${list.length} dispatch${list.length === 1 ? '' : 'es'}`}
                    </div>
                  </div>
                  {list.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-sm">
                      {list.map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-3">
                          <Link href={`/dispatch/${d.id}`} className="text-blue-700 hover:underline">
                            {d.foremanName}
                          </Link>
                          <span className="truncate text-xs text-gray-500">
                            {d.crew.length} crew · {d.equipment.length} equipment
                          </span>
                          <StatusPill label={d.status} tone={statusTone(d.status)} size="sm" />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
