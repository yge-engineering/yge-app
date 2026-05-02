// /dashboard — morning glance.
//
// Replaces the placeholder card grid with a live tile board: today's
// dispatch, cash position, open items, compliance flags. The first
// page Brook + Ryan should look at every morning.

import Link from 'next/link';
import type React from 'react';

import { Alert } from '../../components/alert';
import { AppShell } from '../../components/app-shell';
import { GettingStartedBanner } from '../../components/getting-started-banner';
import { Money } from '../../components/money';
import { RecentActivity } from '../../components/recent-activity';
import { getCurrentUser } from '../../lib/auth';
import { getTranslator } from '../../lib/locale';
import {
  computeArPaymentRollup,
  computeArRollup,
  computeDispatchRollup,
  computeLienWaiverRollup,
  computePunchListRollup,
  computeSwpppRollup,
  computeWeatherLogRollup,
  detectDoubleBookings,
  type ApInvoice,
  type ArInvoice,
  type ArPayment,
  type Dispatch,
  type Job,
  type LienWaiver,
  type PunchItem,
  type Rfi,
  type Submittal,
  type SwpppInspection,
  type WeatherLog,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

/** Tracks whether ANY fetch in the page failed at the network level. */
let apiUnreachable = false;

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    apiUnreachable = true;
    return [];
  }
}

export default async function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [
    jobs,
    customers,
    employees,
    arInvoices,
    arPayments,
    apInvoices,
    rfis,
    submittals,
    lienWaivers,
    punchItems,
    dispatches,
    weatherLogs,
    swpppInspections,
  ] = await Promise.all([
    fetchJson<Job>('/api/jobs', 'jobs'),
    fetchJson<{ id: string }>('/api/customers', 'customers'),
    fetchJson<{ id: string }>('/api/employees', 'employees'),
    fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    fetchJson<ArPayment>('/api/ar-payments', 'payments'),
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
    fetchJson<Rfi>('/api/rfis', 'rfis'),
    fetchJson<Submittal>('/api/submittals', 'submittals'),
    fetchJson<LienWaiver>('/api/lien-waivers', 'waivers'),
    fetchJson<PunchItem>('/api/punch-items', 'items'),
    fetchJson<Dispatch>('/api/dispatches', 'dispatches'),
    fetchJson<WeatherLog>('/api/weather-logs', 'logs'),
    fetchJson<SwpppInspection>('/api/swppp-inspections', 'inspections'),
  ]);

  const arRollup = computeArRollup(arInvoices);
  const arPaymentRollup = computeArPaymentRollup(arPayments);
  const dispatchRollup = computeDispatchRollup(dispatches, today);
  const todayDoubleBookings = detectDoubleBookings(dispatches).filter(
    (db) => db.scheduledFor === today,
  );
  const lwRollup = computeLienWaiverRollup(lienWaivers);
  const punchRollup = computePunchListRollup(punchItems);
  const wxRollup = computeWeatherLogRollup(weatherLogs);
  const swpppRollup = computeSwpppRollup(swpppInspections);

  // AP unpaid total (approved but not yet paid).
  let apUnpaidCents = 0;
  let apUnpaidCount = 0;
  for (const ap of apInvoices) {
    if (ap.status === 'APPROVED') {
      apUnpaidCents += Math.max(0, ap.totalCents - ap.paidCents);
      apUnpaidCount += 1;
    }
  }

  // Open RFIs + submittals.
  const openRfis = rfis.filter(
    (r) => r.status === 'DRAFT' || r.status === 'SENT',
  ).length;
  const openSubmittals = submittals.filter(
    (s) =>
      s.status === 'DRAFT' ||
      s.status === 'SUBMITTED' ||
      s.status === 'REVISE_RESUBMIT',
  ).length;

  const activeJobs = jobs.filter(
    (j) => j.status === 'AWARDED' || j.status === 'PURSUING',
  ).length;

  const todayDispatches = dispatches.filter(
    (d) => d.scheduledFor === today && d.status !== 'CANCELLED',
  );

  const user = getCurrentUser();
  const firstName = user ? user.name.split(' ')[0] : '';
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const t = getTranslator();
  const greetingKey =
    partOfDay === 'morning'
      ? 'dashboard.greeting.morning'
      : partOfDay === 'afternoon'
        ? 'dashboard.greeting.afternoon'
        : 'dashboard.greeting.evening';

  return (
    <AppShell>
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-yge-blue-500">
            {t(greetingKey)}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-gray-600">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}{' '}
            · {t('dashboard.activeJobs', { count: activeJobs })}
          </p>
        </div>
        <Link href="/all-modules" className="text-sm text-yge-blue-500 hover:underline">
          {t('dashboard.allModules')} &rarr;
        </Link>
      </header>

      {apiUnreachable && (
        <Alert tone="warn" title={t('dashboard.apiUnreachable.title')} className="mb-6">
          The dashboard tiles below show zeros because the API server isn&apos;t running. Locally, run{' '}
          <code className="rounded bg-amber-100 px-1 font-mono text-xs">pnpm dev</code> in{' '}
          <code className="rounded bg-amber-100 px-1 font-mono text-xs">apps/api</code>. In production,
          check that <code className="rounded bg-amber-100 px-1 font-mono text-xs">NEXT_PUBLIC_API_URL</code>{' '}
          points at a running API.
        </Alert>
      )}

      <GettingStartedBanner
        customers={customers.length}
        jobs={jobs.length}
        employees={employees.length}
      />

      {/* QUICK ACTIONS — the 4 things you do most */}
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction href="/jobs/new" label={t('dashboard.quickAction.newJob.label')} sub={t('dashboard.quickAction.newJob.sub')} />
        <QuickAction href="/daily-reports/new" label={t('dashboard.quickAction.newDailyReport.label')} sub={t('dashboard.quickAction.newDailyReport.sub')} />
        <QuickAction href="/ar-invoices/new" label={t('dashboard.quickAction.newArInvoice.label')} sub={t('dashboard.quickAction.newArInvoice.sub')} />
        <QuickAction href="/time-cards/new" label={t('dashboard.quickAction.newTimeCard.label')} sub={t('dashboard.quickAction.newTimeCard.sub')} />
      </div>

      {/* COMPLIANCE BAR — anything that's actively a problem */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ComplianceTile
          label={t('dashboard.compliance.heatGaps')}
          value={wxRollup.heatComplianceGaps}
          severity={wxRollup.heatComplianceGaps > 0 ? 'bad' : 'ok'}
          href="/weather"
          ok={t('dashboard.compliance.heatGaps.ok')}
        />
        <ComplianceTile
          label={t('dashboard.compliance.swpppDef')}
          value={swpppRollup.openDeficiencies}
          severity={swpppRollup.openDeficiencies > 0 ? 'bad' : 'ok'}
          href="/swppp"
          ok={t('dashboard.compliance.swpppDef.ok')}
        />
        <ComplianceTile
          label={t('dashboard.compliance.punchSafety')}
          value={punchRollup.openSafety}
          severity={punchRollup.openSafety > 0 ? 'bad' : 'ok'}
          href="/punch-list"
          ok={t('dashboard.compliance.punchSafety.ok')}
        />
        <ComplianceTile
          label={t('dashboard.compliance.dispatchConflicts')}
          value={todayDoubleBookings.length}
          severity={todayDoubleBookings.length > 0 ? 'bad' : 'ok'}
          href={`/dispatch?scheduledFor=${today}`}
          ok={t('dashboard.compliance.dispatchConflicts.ok')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* TODAY'S DISPATCH */}
        <section className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <CardHeader title={t('dashboard.card.todayDispatch')} href={`/dispatch?scheduledFor=${today}`} />
          {todayDispatches.length === 0 ? (
            <p className="text-sm text-gray-500">
              {t('dashboard.card.todayDispatch.empty')}{' '}
              <Link href="/dispatch/new" className="text-yge-blue-500 hover:underline">
                {t('dashboard.addDispatch')} &rarr;
              </Link>
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {todayDispatches.slice(0, 6).map((d) => (
                <Link
                  key={d.id}
                  href={`/dispatch/${d.id}`}
                  className="block rounded border border-gray-200 p-3 hover:bg-gray-50"
                >
                  <div className="text-xs text-gray-500">{d.scheduledFor}</div>
                  <div className="text-sm font-medium text-gray-900 line-clamp-1">
                    {d.foremanName}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-600">
                    {d.crew.length} crew · {d.equipment.length} equip ·{' '}
                    {d.status.toLowerCase()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* CASH POSITION */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <CardHeader title={t('dashboard.card.cashPosition')} href="/wip" />
          <KvRow label={t('dashboard.kv.arOutstanding')} value={<Money cents={arRollup.outstandingCents} />} />
          <KvRow
            label={t('dashboard.kv.collectedLifetime')}
            value={<Money cents={arPaymentRollup.totalCents} />}
          />
          <KvRow
            label={t('dashboard.kv.apUnpaid')}
            value={<>{apUnpaidCount} · <Money cents={apUnpaidCents} /></>}
            warn={apUnpaidCents > 0}
          />
          <KvRow
            label={t('dashboard.kv.retentionReleased')}
            value={<Money cents={arPaymentRollup.retentionReleaseCents} />}
          />
        </section>

        {/* OPEN ITEMS */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <CardHeader title={t('dashboard.card.openItems')} />
          <KvRow label={t('dashboard.kv.openRfis')} value={openRfis} link="/rfis" />
          <KvRow label={t('dashboard.kv.openSubmittals')} value={openSubmittals} link="/submittals" />
          <KvRow
            label={t('dashboard.kv.openPunchItems')}
            value={punchRollup.open + punchRollup.inProgress}
            link="/punch-list"
            warn={punchRollup.overdue > 0}
            warnText={
              punchRollup.overdue > 0 ? t('dashboard.warn.overdue', { count: punchRollup.overdue }) : undefined
            }
          />
          <KvRow
            label={t('dashboard.kv.unsignedUncondWaivers')}
            value={lwRollup.unsignedUnconditional}
            link="/lien-waivers"
            warn={lwRollup.unsignedUnconditional > 0}
            warnText={
              lwRollup.unsignedUnconditional > 0
                ? t('dashboard.warn.uncondCaution')
                : undefined
            }
          />
        </section>

        {/* CREWS TODAY */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <CardHeader title={t('dashboard.card.crewsToday')} />
          <KvRow label={t('dashboard.kv.todayJobs')} value={dispatchRollup.todayCount} />
          <KvRow label={t('dashboard.kv.crewHeadcount')} value={dispatchRollup.todayCrewHeadcount} />
          <KvRow label={t('dashboard.kv.equipmentOut')} value={dispatchRollup.todayEquipmentCount} />
        </section>

        {/* RECENT ACTIVITY */}
        <div className="lg:col-span-2">
          <RecentActivity
            jobs={jobs}
            arInvoices={arInvoices}
            apInvoices={apInvoices}
            rfis={rfis}
            dailyReports={[]}
            dispatches={dispatches}
          />
        </div>

        {/* QUICK ACTIONS */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <CardHeader title={t('dashboard.card.quickActions')} />
          <div className="grid gap-2 sm:grid-cols-3">
            <QuickLink href="/dispatch/new" label={t('dashboard.quickLink.newDispatch')} />
            <QuickLink href="/daily-reports/new" label={t('dashboard.quickLink.dailyReport')} />
            <QuickLink href="/toolbox-talks/new" label={t('dashboard.quickLink.toolboxTalk')} />
            <QuickLink href="/swppp/new" label={t('dashboard.quickLink.swpppInspection')} />
            <QuickLink href="/weather/new" label={t('dashboard.quickLink.logWeather')} />
            <QuickLink href="/incidents/new" label={t('dashboard.quickLink.logIncident')} />
            <QuickLink href="/ar-payments/new" label={t('dashboard.quickLink.recordPayment')} />
            <QuickLink href="/pcos/new" label={t('dashboard.quickLink.newPco')} />
            <QuickLink href="/rfis/new" label={t('dashboard.quickLink.newRfi')} />
          </div>
        </section>
      </div>
    </main>
    </AppShell>
  );
}

function CardHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-xs text-yge-blue-500 hover:underline">
          Open &rarr;
        </Link>
      )}
    </div>
  );
}

function KvRow({
  label,
  value,
  link,
  warn,
  warnText,
}: {
  label: string;
  value: React.ReactNode;
  link?: string;
  warn?: boolean;
  warnText?: string;
}) {
  const inner = (
    <div
      className={`flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-b-0 ${
        warn ? 'text-red-700' : ''
      }`}
    >
      <div>
        <span className={warn ? 'font-semibold' : 'text-gray-700'}>{label}</span>
        {warnText && <div className="text-xs text-red-600">{warnText}</div>}
      </div>
      <span
        className={`font-mono ${warn ? 'font-bold' : 'font-semibold text-gray-900'}`}
      >
        {value}
      </span>
    </div>
  );
  return link ? (
    <Link href={link} className="block hover:bg-gray-50">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ComplianceTile({
  label,
  value,
  severity,
  href,
  ok,
}: {
  label: string;
  value: number;
  severity: 'ok' | 'warn' | 'bad';
  href: string;
  ok: string;
}) {
  const cls =
    severity === 'bad'
      ? 'border-red-300 bg-red-50 text-red-900'
      : severity === 'warn'
        ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
        : 'border-green-300 bg-green-50 text-green-900';
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-3 shadow-sm hover:opacity-90 ${cls}`}
    >
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      {value > 0 ? (
        <div className="mt-1 text-2xl font-bold">{value}</div>
      ) : (
        <div className="mt-1 text-sm font-medium opacity-80">{ok}</div>
      )}
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded border border-yge-blue-500 px-3 py-2 text-center text-sm text-yge-blue-500 hover:bg-yge-blue-50"
    >
      {label}
    </Link>
  );
}

function QuickAction({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-gray-200 bg-white px-4 py-3 hover:border-blue-500 hover:bg-blue-50"
    >
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="mt-0.5 text-xs text-gray-500">{sub}</div>
    </Link>
  );
}
