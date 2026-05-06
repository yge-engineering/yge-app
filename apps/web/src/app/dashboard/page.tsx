// /dashboard — morning glance.
//
// Replaces the placeholder card grid with a live tile board: today's
// dispatch, cash position, open items, compliance flags. The first
// page Brook + Ryan should look at every morning.

import Link from 'next/link';
import type React from 'react';

import { Alert } from '../../components/alert';
import { AppShell } from '../../components/app-shell';
import { BidDueSoonBanner } from '../../components/bid-due-soon-banner';
import { GettingStartedBanner } from '../../components/getting-started-banner';
import { LicenseRenewalBanner } from '../../components/license-renewal-banner';
import { Money } from '../../components/money';
import { RecentActivity } from '../../components/recent-activity';
import { getCurrentUser } from '../../lib/auth';
import { getTranslator } from '../../lib/locale';
import { bidDueCountdown } from '@yge/shared';
import { ygeHour, ygeToday } from '../../lib/yge-time';
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
  type MasterProfile,
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

/** Lightweight pull of /health/integrations to surface AP-inbox
 *  freshness on the dashboard. Kept tolerant of failures so the
 *  rest of the dashboard renders even if the health probe times
 *  out. */
async function fetchApInboxStatus(): Promise<{
  status: 'ok' | 'degraded';
  ageMs?: number;
  lastFinishedAt?: string;
  reason?: string;
}> {
  try {
    const res = await fetch(`${apiBaseUrl()}/health/integrations`, {
      cache: 'no-store',
    });
    if (!res.ok) return { status: 'degraded' };
    const json = (await res.json()) as {
      apInbox?: {
        status?: 'ok' | 'degraded';
        ageMs?: number;
        lastFinishedAt?: string;
        reason?: string;
      };
    };
    const a = json.apInbox;
    return {
      status: a?.status === 'ok' ? 'ok' : 'degraded',
      ageMs: a?.ageMs,
      lastFinishedAt: a?.lastFinishedAt,
      reason: a?.reason,
    };
  } catch {
    return { status: 'degraded' };
  }
}

interface PricedEstimateSummaryLite {
  id: string;
  jobId: string;
  projectName: string;
  bidDueDate?: string;
  bidTotalCents?: number;
  unpricedLineCount?: number;
  updatedAt: string;
}

/** Pull every priced estimate plus a small slice of the most-recent ones
 *  for the dashboard. Sharing the fetch avoids a second request just for
 *  the pipeline-value tile. */
async function fetchEstimatesPipeline(): Promise<{
  recent: PricedEstimateSummaryLite[];
  pipelineCents: number;
  pipelineCount: number;
}> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/priced-estimates`, {
      cache: 'no-store',
    });
    if (!res.ok) return { recent: [], pipelineCents: 0, pipelineCount: 0 };
    const json = (await res.json()) as {
      estimates: PricedEstimateSummaryLite[];
    };
    const all = json.estimates ?? [];
    const recent = [...all]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
    const pipelineCents = all.reduce(
      (sum, e) => sum + (typeof e.bidTotalCents === 'number' ? e.bidTotalCents : 0),
      0,
    );
    return { recent, pipelineCents, pipelineCount: all.length };
  } catch {
    return { recent: [], pipelineCents: 0, pipelineCount: 0 };
  }
}

/** Pull the 5 most-recent priced estimates for the dashboard tile. */
async function fetchRecentEstimates(): Promise<PricedEstimateSummaryLite[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/priced-estimates`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      estimates: PricedEstimateSummaryLite[];
    };
    return [...json.estimates]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
  } catch {
    return [];
  }
}

async function fetchMasterProfile(): Promise<MasterProfile | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/master-profile`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { profile?: MasterProfile };
    return j.profile ?? null;
  } catch {
    return null;
  }
}

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
  // Foremen + crew don't need the full enterprise dashboard (AR aging,
  // RFI counts, dispatch double-bookings, etc.). Redirect them to the
  // focused /me/today view that surfaces just their work.
  const me = (await import('../../lib/auth')).getCurrentUser();
  if (me && (me.role === 'FOREMAN' || me.role === 'CREW')) {
    const { redirect } = await import('next/navigation');
    redirect('/me/today');
  }

  const today = ygeToday();
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
    masterProfile,
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
    fetchMasterProfile(),
  ]);
  const apInboxStatus = await fetchApInboxStatus();
  const pipelineData = await fetchEstimatesPipeline();
  const recentEstimates = pipelineData.recent;

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

  // AP needs review — DRAFT rows from the auto-poll waiting for human
  // approval. The poller stamps "AI extraction" into notes, so DRAFT
  // rows that came from email all bubble up here.
  const apNeedsReview = apInvoices.filter(
    (ap) =>
      ap.status === 'DRAFT' &&
      typeof ap.notes === 'string' &&
      /AI extraction|From: /i.test(ap.notes),
  ).length;

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

  // "Active" means jobs that are running in the field (status AWARDED).
  // PURSUING + BID_SUBMITTED are bids in flight, not active jobs — keep
  // them separate so the dashboard greeting doesn't read "3 active jobs"
  // when those are really 3 bids we're working on.
  const activeJobs = jobs.filter((j) => j.status === 'AWARDED').length;
  const pursuingJobs = jobs.filter(
    (j) => j.status === 'PURSUING' || j.status === 'BID_SUBMITTED',
  ).length;

  const todayDispatches = dispatches.filter(
    (d) => d.scheduledFor === today && d.status !== 'CANCELLED',
  );

  const user = getCurrentUser();
  const firstName = user ? user.name.split(' ')[0] : '';
  const hour = ygeHour();
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
            {new Date().toLocaleDateString('en-US', {
              timeZone: 'America/Los_Angeles',
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}{' '}
            · {t('dashboard.activeJobs', { count: activeJobs })}
            {pursuingJobs > 0 && (
              <>
                {' · '}
                {pursuingJobs === 1
                  ? '1 bid in flight'
                  : `${pursuingJobs} bids in flight`}
              </>
            )}
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

      <LicenseRenewalBanner profile={masterProfile} />

      <BidDueSoonBanner jobs={jobs} />

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

      {/* AP INBOX FRESHNESS — last-poll age. Blank when unknown so
          we don't shout at first boot before the scheduler ticks. */}
      {(apInboxStatus.lastFinishedAt || apInboxStatus.reason) && (
        <div className="mb-6">
          <ApInboxFreshnessTile status={apInboxStatus} />
        </div>
      )}

      {/* BID PIPELINE — sum of bid totals across all priced estimates. */}
      {pipelineData.pipelineCount > 0 && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yge-blue-200 bg-yge-blue-50 px-3 py-1 text-xs font-medium text-yge-blue-700">
          <span className="uppercase tracking-wide opacity-70">Bid pipeline</span>
          <span className="font-mono font-semibold">
            <Money cents={pipelineData.pipelineCents} />
          </span>
          <span className="opacity-70">
            · {pipelineData.pipelineCount} estimate{pipelineData.pipelineCount === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* RECENT ESTIMATES — most-recently-edited bids. */}
      {recentEstimates.length > 0 && (
        <div className="mb-6">
          <RecentEstimatesTile estimates={recentEstimates} />
        </div>
      )}

      {/* AP NEEDS REVIEW — auto-poll DRAFT rows waiting for human pass */}
      {apNeedsReview > 0 && (
        <div className="mb-6">
          <Link
            href="/ap-invoices?status=DRAFT"
            className="block rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm hover:bg-amber-100"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              AP needs review
            </div>
            <div className="mt-1 text-2xl font-bold text-amber-900">
              {apNeedsReview} invoice{apNeedsReview === 1 ? '' : 's'}
            </div>
            <div className="text-xs text-amber-800">
              From the auto-poll · click to open the AP list filtered to DRAFT.
            </div>
          </Link>
        </div>
      )}

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

// Recent estimates tile. The 5 most-recently-edited bids with
// project name, bid total, due date, and an unpriced-line count
// hint. Click any row to jump straight into the editor.
function RecentEstimateDuePill({ iso }: { iso: string | undefined }) {
  const c = bidDueCountdown(iso, undefined, 'en');
  if (c.level === 'none') {
    return <span className="text-gray-500">No bid date</span>;
  }
  const tone =
    c.level === 'red'
      ? 'border-red-300 bg-red-50 text-red-800'
      : c.level === 'orange'
        ? 'border-orange-300 bg-orange-50 text-orange-800'
        : c.level === 'yellow'
          ? 'border-yellow-300 bg-yellow-50 text-yellow-800'
          : 'border-green-300 bg-green-50 text-green-800';
  return (
    <span
      title={c.longLabel}
      className={`inline-block rounded-full border px-1.5 py-0.5 font-semibold uppercase tracking-wide ${tone}`}
    >
      Due · {c.shortLabel}
    </span>
  );
}

function RecentEstimatesTile({
  estimates,
}: {
  estimates: PricedEstimateSummaryLite[];
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Recent estimates
        </h3>
        <Link
          href="/estimates"
          className="text-xs text-yge-blue-500 hover:underline"
        >
          See all →
        </Link>
      </header>
      <ul className="divide-y divide-gray-100 text-sm">
        {estimates.map((e) => (
          <li key={e.id}>
            <Link
              href={`/estimates/${e.id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900">
                  {e.projectName}
                </div>
                <div className="text-[11px] text-gray-500">
                  <RecentEstimateDuePill iso={e.bidDueDate} />
                  {(e.unpricedLineCount ?? 0) > 0 ? (
                    <span className="ml-2 text-amber-700">
                      · {e.unpricedLineCount} unpriced
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="text-right font-mono">
                {typeof e.bidTotalCents === 'number' ? (
                  <Money cents={e.bidTotalCents} />
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// AP-inbox freshness tile. Reads the apInbox subobject from
// /health/integrations and surfaces age + status in a single
// glance-friendly tile. Green if last poll under 30 minutes ago,
// amber under 90, red over 90 (or never). Clicking jumps to AP
// invoices DRAFT view where ingested invoices land.
function ApInboxFreshnessTile({
  status,
}: {
  status: {
    status: 'ok' | 'degraded';
    ageMs?: number;
    lastFinishedAt?: string;
    reason?: string;
  };
}) {
  const ageMs = status.ageMs ?? Number.POSITIVE_INFINITY;
  const minutes = Math.round(ageMs / 60_000);
  const tone =
    status.status === 'ok' && ageMs <= 30 * 60_000
      ? 'border-green-300 bg-green-50 text-green-900'
      : ageMs <= 90 * 60_000
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-red-300 bg-red-50 text-red-900';
  const label =
    status.lastFinishedAt && Number.isFinite(ageMs)
      ? minutes < 1
        ? 'Just now'
        : minutes < 60
          ? `${minutes} min ago`
          : `${Math.round(minutes / 60)} hr ago`
      : 'No poll yet';
  return (
    <Link
      href="/ap-invoices?status=DRAFT"
      className={`block rounded-lg border px-4 py-3 shadow-sm hover:opacity-90 ${tone}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
            AP inbox auto-poll
          </div>
          <div className="mt-0.5 text-base font-semibold">
            Last poll: {label}
          </div>
          {status.reason && (
            <div className="mt-0.5 text-[11px] opacity-80">{status.reason}</div>
          )}
        </div>
        <div className="text-right text-[11px] opacity-70">
          {status.lastFinishedAt
            ? new Date(status.lastFinishedAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : ''}
        </div>
      </div>
    </Link>
  );
}
