// /print/morning-briefing — print-optimized briefing.

import { requirePermission } from '../../../lib/permissions';
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

export default async function PrintMorningBriefingPage({
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

  const brief = buildMorningBriefing({
    forDate,
    dailyReports,
    dispatches,
    incidents,
    employees,
    vendors,
    arInvoices,
  });

  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-6 text-black print:max-w-none print:px-4 print:py-0">
      <header className="mb-4 border-b-2 border-gray-800 pb-2">
        <h1 className="text-xl font-bold">YGE Morning Briefing</h1>
        <p className="text-sm">
          For {brief.forDate} · Yesterday: {brief.yesterdayDate}
        </p>
      </header>

      {brief.headlines.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase tracking-wide">
            Headlines
          </h2>
          <ul className="list-disc pl-5 text-sm">
            {brief.headlines.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-4">
        <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase tracking-wide">
          Today's dispatches ({brief.todayDispatches.length})
        </h2>
        {brief.todayDispatches.length === 0 ? (
          <p className="text-sm italic text-gray-700">No dispatches scheduled.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">Job</th>
                <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">Foreman</th>
                <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">Meet</th>
                <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">Crew</th>
                <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">Equip</th>
              </tr>
            </thead>
            <tbody>
              {brief.todayDispatches.map((d, i) => (
                <tr key={i}>
                  <td className="py-1 font-mono text-xs">{d.jobId.slice(-6)}</td>
                  <td className="py-1">{d.foremanName}</td>
                  <td className="py-1 text-xs">
                    {d.meetTime ? d.meetTime : '—'}
                    {d.meetLocation ? ` @ ${d.meetLocation}` : ''}
                  </td>
                  <td className="py-1 font-mono">{d.crewCount}</td>
                  <td className="py-1 font-mono">{d.equipmentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-4">
        <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase tracking-wide">
          Yesterday's reports ({brief.yesterdayReportCount})
        </h2>
        {brief.yesterdayMissingReports.length > 0 ? (
          <p className="mb-1 text-sm font-semibold text-red-800">
            ⚠ {brief.yesterdayMissingReports.length} job
            {brief.yesterdayMissingReports.length === 1 ? '' : 's'} missing a report.
          </p>
        ) : null}
        {brief.yesterdayReports.length === 0 ? (
          <p className="text-sm italic text-gray-700">No reports submitted.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {brief.yesterdayReports.map((r, i) => (
              <li key={i}>
                Job {r.jobId.slice(-6)} — {r.crewHours.toFixed(1)}h crew
                {r.weatherCondition ? ` · ${r.weatherCondition}` : ''}
                {r.hasIssues ? ' · ⚠ flagged issues' : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      {brief.openIncidents.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase tracking-wide">
            Open safety incidents ({brief.openIncidents.length})
          </h2>
          <ul className="list-disc pl-5 text-sm">
            {brief.openIncidents.map((inc) => (
              <li key={inc.id}>
                {inc.classification} — {inc.outcome} · {inc.daysOpen}d open
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brief.expiringCerts.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase tracking-wide">
            Expiring certifications
          </h2>
          <ul className="list-disc pl-5 text-sm">
            {brief.expiringCerts.map((cert, i) => (
              <li key={i}>
                {cert.who} — {cert.certType} · expires {cert.expiresOn}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-6 border-t border-gray-300 pt-2 text-[10px] text-gray-600">
        Generated from YGE App at the start of {forDate}. Hand a copy to each foreman at the yard meet.
      </footer>
    </main>
  );
}
