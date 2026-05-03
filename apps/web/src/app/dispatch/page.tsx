// /dispatch — daily dispatch board.
//
// Plain English: today's crew + equipment assignments. Print one yard
// handout per job. Double-bookings (same crew member or piece of
// equipment assigned to two dispatches the same day) get flagged at
// the top — that's the call-the-foreman situation.

import Link from 'next/link';

import {
  Alert,
  AppShell,
  Avatar,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getLocale, getTranslator, type Translator } from '../../lib/locale';
import type { Locale } from '@yge/shared';
import {
  computeDispatchRollup,
  detectDoubleBookings,
  dispatchStatusLabel,
  type Dispatch,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchDispatches(filter: {
  scheduledFor?: string;
  jobId?: string;
}): Promise<Dispatch[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/dispatches`);
    if (filter.scheduledFor) url.searchParams.set('scheduledFor', filter.scheduledFor);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { dispatches: Dispatch[] }).dispatches;
  } catch { return []; }
}
async function fetchAll(): Promise<Dispatch[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/dispatches`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { dispatches: Dispatch[] }).dispatches;
  } catch { return []; }
}

function statusTone(s: Dispatch['status']): 'success' | 'warn' | 'danger' | 'muted' | 'neutral' {
  switch (s) {
    case 'POSTED': return 'success';
    case 'COMPLETED': return 'muted';
    case 'CANCELLED': return 'danger';
    case 'DRAFT': return 'warn';
    default: return 'neutral';
  }
}

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: { scheduledFor?: string; jobId?: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const filter = {
    scheduledFor: searchParams.scheduledFor ?? today,
    jobId: searchParams.jobId,
  };
  const [dispatches, all] = await Promise.all([fetchDispatches(filter), fetchAll()]);
  const rollup = computeDispatchRollup(all, today);
  const doubleBookings = detectDoubleBookings(all);
  const todaysDoubleBookings = doubleBookings.filter(
    (db) => db.scheduledFor === filter.scheduledFor,
  );

  const csvHref = `${publicApiBaseUrl()}/api/dispatches?format=csv&scheduledFor=${encodeURIComponent(filter.scheduledFor)}${
    filter.jobId ? '&jobId=' + encodeURIComponent(filter.jobId) : ''
  }`;
  const t = getTranslator();
  const locale = getLocale();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('dispatch.title')}
          subtitle={t('dispatch.subtitle')}
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {t('dispatch.downloadCsv')}
              </a>
              <LinkButton href="/dispatch/new" variant="primary" size="md">
                {t('dispatch.newDispatch')}
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('dispatch.tile.todayJobs')} value={rollup.todayCount} />
          <Tile label={t('dispatch.tile.crewToday')} value={rollup.todayCrewHeadcount} />
          <Tile label={t('dispatch.tile.equipmentToday')} value={rollup.todayEquipmentCount} />
          <Tile
            label={t('dispatch.tile.doubleBookings')}
            value={rollup.doubleBookings}
            tone={rollup.doubleBookings > 0 ? 'danger' : 'success'}
          />
        </section>

        {todaysDoubleBookings.length > 0 ? (
          <Alert tone="danger" title={`Double-booked on ${filter.scheduledFor}:`} className="mb-4">
            <ul className="list-disc pl-5">
              {todaysDoubleBookings.map((db, i) => (
                <li key={i}>
                  {db.kind === 'CREW' ? 'Crew member' : 'Equipment'} <strong>{db.name}</strong> assigned to{' '}
                  {db.dispatchIds.length} dispatches
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('dispatch.day.label')}</span>
          <DayLink label={t('dispatch.day.today')} date={today} active={filter.scheduledFor === today} />
          <DayLink label={t('dispatch.day.tomorrow')} date={addDays(today, 1)} active={filter.scheduledFor === addDays(today, 1)} />
          <DayLink label={t('dispatch.day.yesterday')} date={addDays(today, -1)} active={filter.scheduledFor === addDays(today, -1)} />
          <form action="/dispatch" className="ml-2 flex items-center gap-2">
            <input
              type="date"
              name="scheduledFor"
              defaultValue={filter.scheduledFor}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <button
              type="submit"
              className="rounded-md border border-blue-700 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
            >
              {t('dispatch.day.go')}
            </button>
          </form>
        </section>

        {dispatches.length === 0 ? (
          <EmptyState
            title={t('dispatch.empty.title', { date: filter.scheduledFor })}
            body={t('dispatch.empty.body')}
            actions={[{ href: '/dispatch/new', label: t('dispatch.empty.action'), primary: true }]}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {dispatches.map((d) => (
              <DispatchCard key={d.id} d={d} t={t} locale={locale} />
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function DispatchCard({ d, t, locale }: { d: Dispatch; t: Translator; locale: Locale }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">{d.scheduledFor}</div>
          <Link href={`/dispatch/${d.id}`} className="text-lg font-semibold text-blue-700 hover:underline">
            <span className="font-mono">{d.jobId}</span>
          </Link>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-700">
            <Avatar name={d.foremanName} size="sm" />
            <span>
              {t('dispatch.card.foreman')}: {d.foremanName}
              {d.foremanPhone ? ` · ${d.foremanPhone}` : ''}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill label={dispatchStatusLabel(d.status, locale)} tone={statusTone(d.status)} />
          <Link href={`/dispatch/${d.id}/handout`} className="text-xs text-blue-700 hover:underline">
            {t('dispatch.card.printHandout')}
          </Link>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="font-semibold uppercase text-gray-500">{t('dispatch.card.meet')}</div>
          <div>{d.meetTime ?? '—'}</div>
          <div className="text-gray-600">{d.meetLocation ?? '—'}</div>
        </div>
        <div>
          <div className="font-semibold uppercase text-gray-500">{t('dispatch.card.headcount')}</div>
          <div>{d.crew.length} crew · {d.equipment.length} equip</div>
        </div>
      </div>
      <div className="mt-3">
        <div className="text-xs font-semibold uppercase text-gray-500">{t('dispatch.card.scope')}</div>
        <div className="line-clamp-3 text-sm text-gray-800">{d.scopeOfWork}</div>
      </div>
      {d.crew.length > 0 ? (
        <div className="mt-2 text-xs text-gray-700">
          <span className="font-semibold">{t('dispatch.card.crew')}:</span> {d.crew.map((c) => c.name).join(', ')}
        </div>
      ) : null}
      {d.equipment.length > 0 ? (
        <div className="mt-1 text-xs text-gray-700">
          <span className="font-semibold">{t('dispatch.card.equipment')}:</span> {d.equipment.map((e) => e.name).join(', ')}
        </div>
      ) : null}
    </Card>
  );
}

function DayLink({
  label,
  date,
  active,
}: {
  label: string;
  date: string;
  active: boolean;
}) {
  return (
    <Link
      href={`/dispatch?scheduledFor=${date}`}
      className={`rounded px-2 py-1 text-xs ${
        active
          ? 'bg-blue-700 text-white'
          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label} ({date})
    </Link>
  );
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
