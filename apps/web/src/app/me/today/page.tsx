// /me/today — what's on the signed-in user's plate today.
//
// Plain English: instead of scanning the whole dashboard, this page
// filters to just YOU — your assigned dispatches, daily reports
// you owe, RFIs you authored that are still open, your time card
// for the week.

import Link from 'next/link';

import { AppShell, Card, EmptyState, LinkButton, PageHeader, StatusPill } from '../../../components';
import { getCurrentUser } from '../../../lib/auth';
import type { DailyReport, Dispatch, Rfi, TimeCard } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStartingFor(today: string): string {
  // CA Greenbook week starts Monday. Compute Monday of the current week.
  const d = new Date(`${today}T00:00:00`);
  const dow = d.getDay();
  const offsetToMon = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offsetToMon);
  return d.toISOString().slice(0, 10);
}

export default async function MyTodayPage() {
  const user = getCurrentUser();
  const today = todayIso();
  const week = weekStartingFor(today);

  const [dispatches, dailyReports, rfis, timeCards] = await Promise.all([
    fetchJson<Dispatch>('/api/dispatches', 'dispatches'),
    fetchJson<DailyReport>('/api/daily-reports', 'reports'),
    fetchJson<Rfi>('/api/rfis', 'rfis'),
    fetchJson<TimeCard>('/api/time-cards', 'timeCards'),
  ]);

  const myName = user?.name ?? '';
  const myEmail = user?.email ?? '';

  // My dispatches today (matched by foreman name OR by being on the crew).
  const myDispatchesToday = dispatches.filter((d) => {
    if (d.scheduledFor !== today) return false;
    if (d.foremanName && myName && d.foremanName.toLowerCase() === myName.toLowerCase()) return true;
    return d.crew.some((c) => c.name.toLowerCase() === myName.toLowerCase());
  });

  // My daily reports owed today (foreman = me, no report yet for today).
  const myDailyReports = dailyReports.filter(
    (r) => r.date === today && r.foremanId.toLowerCase() === myEmail.toLowerCase(),
  );

  // My open RFIs (ones I authored).
  const myOpenRfis = rfis.filter(
    (r) => (r.askedByEmployeeId ?? '').toLowerCase() === myEmail.toLowerCase() && (r.status === 'DRAFT' || r.status === 'SENT'),
  );

  // My time card for this week.
  const myTimeCard = timeCards.find((t) => t.weekStarting === week && t.employeeId.toLowerCase() === myEmail.toLowerCase());

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title={`Today, ${user?.name?.split(' ')[0] ?? 'you'}`}
          subtitle="Your stuff, filtered out of the team-wide dashboard."
        />

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Dispatches I&apos;m on today</h2>
              <Link href="/dispatch" className="text-xs text-blue-700 hover:underline">
                see all dispatches
              </Link>
            </div>
            {myDispatchesToday.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing scheduled. If you should be on a dispatch today, tell Brook or Ryan.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {myDispatchesToday.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <Link href={`/dispatch/${d.id}`} className="text-blue-700 hover:underline">
                      {d.foremanName === myName ? `Leading: ${d.scopeOfWork.slice(0, 50)}` : `Crew on ${d.foremanName}'s job`}
                    </Link>
                    <StatusPill label={d.status} tone={d.status === 'POSTED' ? 'info' : 'neutral'} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Daily reports owed</h2>
              <LinkButton href="/daily-reports/new" variant="primary" size="sm">
                + New report
              </LinkButton>
            </div>
            {myDailyReports.length === 0 ? (
              <p className="text-sm text-gray-500">If you led a crew today, you owe a daily report. Click &ldquo;+ New report&rdquo; above.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {myDailyReports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/daily-reports/${r.id}`} className="text-blue-700 hover:underline">
                      {r.date} report
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">My open RFIs</h2>
              <Link href="/rfis" className="text-xs text-blue-700 hover:underline">
                see all RFIs
              </Link>
            </div>
            {myOpenRfis.length === 0 ? (
              <p className="text-sm text-gray-500">No open RFIs you authored.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {myOpenRfis.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <Link href={`/rfis/${r.id}`} className="text-blue-700 hover:underline">
                      RFI {r.rfiNumber}: {r.subject}
                    </Link>
                    <StatusPill label={r.status} tone={r.status === 'SENT' ? 'warn' : 'neutral'} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">My time card this week</h2>
              <span className="text-xs text-gray-500">Week of {week}</span>
            </div>
            {!myTimeCard ? (
              <EmptyState
                title="No time card yet"
                body="Your weekly hours card hasn't been started. Submit by Friday to make payroll."
                actions={[{ href: '/time-cards/new', label: 'Start time card', primary: true }]}
                compact
              />
            ) : (
              <div className="text-sm">
                <Link href={`/time-cards/${myTimeCard.id}`} className="text-blue-700 hover:underline">
                  {myTimeCard.entries.length} entries · status {myTimeCard.status}
                </Link>
              </div>
            )}
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
