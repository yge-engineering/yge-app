// /morning-briefing — daily standup brief for Brook and Ryan.

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import {
  buildMorningBriefing,
  type ArInvoice,
  type DailyReport,
  type Dispatch,
  type Employee,
  type Incident,
  type Vendor,
} from '@yge/shared';

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

function isIsoDate(s: string | undefined): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function MorningBriefingPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  requirePermission('financials:view');

  const forDate = isIsoDate(searchParams.date)
    ? searchParams.date
    : new Date().toISOString().slice(0, 10);

  const [dailyReports, dispatches, incidents, employees, vendors, arInvoices] =
    await Promise.all([
      fetchJson<DailyReport>('/api/daily-reports', 'reports'),
      fetchJson<Dispatch>('/api/dispatches', 'dispatches'),
      fetchJson<Incident>('/api/incidents', 'incidents'),
      fetchJson<Employee>('/api/employees', 'employees'),
      fetchJson<Vendor>('/api/vendors', 'vendors'),
      fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    ]);

  const briefing = buildMorningBriefing({
    forDate,
    dailyReports,
    dispatches,
    incidents,
    employees,
    vendors,
    arInvoices,
  });

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Morning briefing"
          subtitle={`For ${briefing.forDate} (yesterday: ${briefing.yesterdayDate}). Print or screenshot for the yard meet.`}
        />

        <form
          action="/morning-briefing"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3"
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">For date</span>
            <input
              type="date"
              name="date"
              defaultValue={forDate}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
          >
            Refresh
          </button>
        </form>

        {briefing.headlines.length > 0 ? (
          <section className="mb-4 rounded-md border border-yge-blue-300 bg-yge-blue-50 p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-yge-blue-900">
              Headlines
            </h2>
            <ul className="list-disc pl-5 text-sm text-yge-blue-900">
              {briefing.headlines.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Yesterday in review — {briefing.yesterdayDate} ({briefing.yesterdayReportCount} report
            {briefing.yesterdayReportCount === 1 ? '' : 's'})
          </h2>
          {briefing.yesterdayReports.length === 0 ? (
            <p className="text-sm text-gray-600">
              No daily reports submitted for yesterday.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {briefing.yesterdayReports.map((r, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1 last:border-0"
                >
                  <div>
                    <Link
                      href={`/jobs/${r.jobId}`}
                      className="font-mono text-xs text-yge-blue-700 hover:underline"
                    >
                      {r.jobId.slice(-6)}
                    </Link>
                    {r.weatherCondition ? (
                      <span className="ml-2 text-xs text-gray-500">
                        {r.weatherCondition}
                        {typeof r.temperatureF === 'number'
                          ? ` ${r.temperatureF}°F`
                          : ''}
                      </span>
                    ) : null}
                    {r.hasIssues ? (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800">
                        Issues
                      </span>
                    ) : null}
                  </div>
                  <span className="font-mono text-xs text-gray-600">
                    {r.crewHours.toFixed(1)}h crew
                  </span>
                </li>
              ))}
            </ul>
          )}
          {briefing.yesterdayMissingReports.length > 0 ? (
            <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">
              ⚠ Missing daily reports on {briefing.yesterdayMissingReports.length} job
              {briefing.yesterdayMissingReports.length === 1 ? '' : 's'} — chase the foreman.
            </p>
          ) : null}
        </section>

        <section className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Today on the board — {briefing.forDate}
          </h2>
          {briefing.todayDispatches.length === 0 ? (
            <p className="text-sm text-gray-600">No dispatches scheduled for today.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {briefing.todayDispatches.map((d, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1 last:border-0"
                >
                  <div>
                    <Link
                      href={`/jobs/${d.jobId}`}
                      className="font-mono text-xs text-yge-blue-700 hover:underline"
                    >
                      {d.jobId.slice(-6)}
                    </Link>
                    <span className="ml-2 text-gray-800">{d.foremanName}</span>
                    {d.meetTime ? (
                      <span className="ml-2 text-xs text-gray-500">
                        @ {d.meetTime}
                        {d.meetLocation ? ` (${d.meetLocation})` : ''}
                      </span>
                    ) : null}
                  </div>
                  <span className="font-mono text-xs text-gray-600">
                    {d.crewCount} crew · {d.equipmentCount} equip
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Open incidents
          </h2>
          {briefing.openIncidents.length === 0 ? (
            <p className="text-sm text-gray-600">No open incidents.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {briefing.openIncidents.map((inc) => (
                <li
                  key={inc.id}
                  className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1 last:border-0"
                >
                  <span className="text-gray-800">
                    {inc.classification} — {inc.outcome}
                  </span>
                  <span className="font-mono text-xs text-gray-600">
                    {inc.daysOpen}d open
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Expiring certifications
          </h2>
          {briefing.expiringCerts.length === 0 ? (
            <p className="text-sm text-gray-600">
              No certifications expiring in the next 30 days.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {briefing.expiringCerts.map((cert, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1 last:border-0"
                >
                  <span className="text-gray-800">
                    {cert.who} — {cert.certType}
                  </span>
                  <span className="font-mono text-xs text-gray-600">
                    {cert.daysToExpiry < 0
                      ? `${Math.abs(cert.daysToExpiry)}d past`
                      : `in ${cert.daysToExpiry}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Oldest AR to chase
          </h2>
          {briefing.oldestArInvoices.length === 0 ? (
            <p className="text-sm text-gray-600">All AR is current.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {briefing.oldestArInvoices.map((inv) => (
                <li
                  key={inv.invoiceId}
                  className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1 last:border-0"
                >
                  <div>
                    <Link
                      href={`/ar-invoices/${inv.invoiceId}`}
                      className="font-mono text-xs text-yge-blue-700 hover:underline"
                    >
                      #{inv.invoiceNumber}
                    </Link>
                    <span className="ml-2 text-gray-800">{inv.customerName}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-amber-700">
                      <Money cents={inv.openCents} />
                    </span>
                    <span className="ml-2 text-xs text-gray-600">
                      {inv.daysOverdue}d past
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-6 text-xs text-gray-500">
          Generated from daily reports + dispatch board + incident log +
          AR aging. If a section reads &quot;none,&quot; it&apos;s a
          good morning.
        </p>
      </main>
    </AppShell>
  );
}
