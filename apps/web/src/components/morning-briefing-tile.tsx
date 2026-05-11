// Dashboard tile — morning-briefing headlines preview.
//
// Plain English: top 3 headlines from today's briefing, with a link
// to the full page. Saves Brook a click first thing in the morning.

import Link from 'next/link';
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

export async function MorningBriefingTile() {
  const forDate = new Date().toISOString().slice(0, 10);
  const [dailyReports, dispatches, incidents, employees, vendors, arInvoices] =
    await Promise.all([
      fetchJson<DailyReport>('/api/daily-reports', 'reports'),
      fetchJson<Dispatch>('/api/dispatches', 'dispatches'),
      fetchJson<Incident>('/api/incidents', 'incidents'),
      fetchJson<Employee>('/api/employees', 'employees'),
      fetchJson<Vendor>('/api/vendors', 'vendors'),
      fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    ]);

  const brief = buildMorningBriefing({
    forDate,
    dailyReports,
    dispatches,
    incidents,
    employees,
    vendors,
    arInvoices,
  });

  const topHeadlines = brief.headlines.slice(0, 3);

  return (
    <section className="mb-6 rounded-md border border-yge-blue-300 bg-yge-blue-50 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-yge-blue-900">
            Morning briefing — {forDate}
          </h2>
          <p className="text-xs text-yge-blue-900">
            {brief.yesterdayReportCount} report
            {brief.yesterdayReportCount === 1 ? '' : 's'} yesterday ·{' '}
            {brief.todayDispatches.length} dispatch
            {brief.todayDispatches.length === 1 ? '' : 'es'} today ·{' '}
            {brief.yesterdayMissingReports.length} missing
          </p>
        </div>
        <Link
          href="/morning-briefing"
          className="text-xs font-semibold text-yge-blue-700 hover:underline"
        >
          Full brief →
        </Link>
      </header>
      {topHeadlines.length === 0 ? (
        <p className="mt-2 text-sm text-yge-blue-900">
          Nothing urgent — quiet morning. ☕
        </p>
      ) : (
        <ul className="mt-2 list-disc pl-5 text-sm text-yge-blue-900">
          {topHeadlines.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
