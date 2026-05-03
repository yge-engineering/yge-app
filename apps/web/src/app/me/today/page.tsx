// /me/today — what's on the signed-in user's plate today.
//
// Plain English: instead of scanning the whole dashboard, this page
// filters to just YOU — your assigned dispatches, daily reports
// you owe, RFIs you authored that are still open, your time card
// for the week.

import Link from 'next/link';

import { AppShell, Card, EmptyState, LinkButton, PageHeader, StatusPill } from '../../../components';
import { getCurrentUser } from '../../../lib/auth';
import { getTranslator } from '../../../lib/locale';
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
  const myTimeCard = timeCards.find((tc) => tc.weekStarting === week && tc.employeeId.toLowerCase() === myEmail.toLowerCase());
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title={t('today.title', { name: user?.name?.split(' ')[0] ?? t('today.fallbackName') })}
          subtitle={t('today.subtitle')}
        />

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{t('today.h.dispatches')}</h2>
              <Link href="/dispatch" className="text-xs text-blue-700 hover:underline">
                {t('today.dispatches.seeAll')}
              </Link>
            </div>
            {myDispatchesToday.length === 0 ? (
              <p className="text-sm text-gray-500">{t('today.dispatches.empty')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {myDispatchesToday.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <Link href={`/dispatch/${d.id}`} className="text-blue-700 hover:underline">
                      {d.foremanName === myName
                        ? t('today.dispatches.leading', { scope: d.scopeOfWork.slice(0, 50) })
                        : t('today.dispatches.crewOn', { foreman: d.foremanName })}
                    </Link>
                    <StatusPill label={d.status} tone={d.status === 'POSTED' ? 'info' : 'neutral'} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{t('today.h.dailyReports')}</h2>
              <LinkButton href="/daily-reports/new" variant="primary" size="sm">
                {t('today.dailyReports.new')}
              </LinkButton>
            </div>
            {myDailyReports.length === 0 ? (
              <p className="text-sm text-gray-500">{t('today.dailyReports.empty')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {myDailyReports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/daily-reports/${r.id}`} className="text-blue-700 hover:underline">
                      {t('today.dailyReports.label', { date: r.date })}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{t('today.h.rfis')}</h2>
              <Link href="/rfis" className="text-xs text-blue-700 hover:underline">
                {t('today.rfis.seeAll')}
              </Link>
            </div>
            {myOpenRfis.length === 0 ? (
              <p className="text-sm text-gray-500">{t('today.rfis.empty')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {myOpenRfis.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <Link href={`/rfis/${r.id}`} className="text-blue-700 hover:underline">
                      {t('today.rfis.label', { number: r.rfiNumber, subject: r.subject })}
                    </Link>
                    <StatusPill label={r.status} tone={r.status === 'SENT' ? 'warn' : 'neutral'} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{t('today.h.timeCard')}</h2>
              <span className="text-xs text-gray-500">{t('today.timeCard.weekOf', { date: week })}</span>
            </div>
            {!myTimeCard ? (
              <EmptyState
                title={t('today.timeCard.empty.title')}
                body={t('today.timeCard.empty.body')}
                actions={[{ href: '/time-cards/new', label: t('today.timeCard.empty.action'), primary: true }]}
                compact
              />
            ) : (
              <div className="text-sm">
                <Link href={`/time-cards/${myTimeCard.id}`} className="text-blue-700 hover:underline">
                  {t('today.timeCard.summary', { entries: myTimeCard.entries.length, status: myTimeCard.status })}
                </Link>
              </div>
            )}
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
