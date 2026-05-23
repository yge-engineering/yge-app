// /time-cards — weekly time card list.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import { getLocale, getTranslator } from '../../lib/locale';
import {
  attentionRows,
  fullName,
  projectOvertime,
  timeCardStatusLabel,
  totalCardHours,
  type Employee,
  type TimeCard,
  type TimeCardStatus,
} from '@yge/shared';

const STATUSES: TimeCardStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchCards(filter: { status?: string; employeeId?: string }): Promise<TimeCard[]> {
  const url = new URL(`${apiBaseUrl()}/api/time-cards`);
  if (filter.status) url.searchParams.set('status', filter.status);
  if (filter.employeeId) url.searchParams.set('employeeId', filter.employeeId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { timeCards: TimeCard[] }).timeCards;
}
async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { employees: Employee[] }).employees;
}

export default async function TimeCardsPage({
  searchParams,
}: {
  searchParams: { status?: string; employeeId?: string };
}) {
  const [cards, employees] = await Promise.all([
    fetchCards(searchParams),
    fetchEmployees(),
  ]);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const t = getTranslator();
  const locale = getLocale();

  function buildHref(overrides: Partial<{ status?: string; employeeId?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.employeeId) params.set('employeeId', merged.employeeId);
    const q = params.toString();
    return q ? `/time-cards?${q}` : '/time-cards';
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">&larr; Dashboard</Link>
        <Link
          href="/time-cards/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          {t('timecards.newTimeCard')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('timecards.title')}</h1>
      <p className="mt-2 text-gray-700">{t('timecards.subtitle')}</p>

      <OvertimeAttentionBanner cards={cards} employees={employees} />

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">{t('timecards.filter.status')}</span>
        <Link
          href={buildHref({ status: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          {t('timecards.filter.all')}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s })}
            className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {timeCardStatusLabel(s, locale)}
          </Link>
        ))}
      </section>

      {cards.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          {t('timecards.empty')}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">{t('timecards.col.weekOf')}</th>
                <th className="px-4 py-2">{t('timecards.col.employee')}</th>
                <th className="px-4 py-2">{t('timecards.col.entries')}</th>
                <th className="px-4 py-2">{t('timecards.col.totalHrs')}</th>
                <th className="px-4 py-2">{t('timecards.col.status')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cards.map((c) => {
                const emp = empById.get(c.employeeId);
                const total = totalCardHours(c);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.weekStarting}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {emp ? fullName(emp) : c.employeeId}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{c.entries.length}</td>
                    <td className="px-4 py-3 text-sm font-medium tabular-nums text-gray-900">
                      {total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${
                          c.status === 'POSTED' || c.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : c.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : c.status === 'SUBMITTED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {timeCardStatusLabel(c.status, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/time-cards/${c.id}`} className="text-yge-blue-500 hover:underline">
                        {t('timecards.open')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </AppShell>
  );
}

function currentMondayIso(): string {
  const d = new Date();
  const dow = d.getUTCDay(); // Sun = 0
  const sinceMonday = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function OvertimeAttentionBanner({
  cards,
  employees,
}: {
  cards: TimeCard[];
  employees: Employee[];
}) {
  const weekStarting = currentMondayIso();
  const rows = projectOvertime({
    timeCards: cards,
    weekStarting,
    asOfDate: todayIso(),
  });
  const attention = attentionRows(rows);
  if (attention.length === 0) return null;
  const empById = new Map(employees.map((e) => [e.id, e]));
  return (
    <section className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-amber-900">
        Overtime watch — {attention.length} {attention.length === 1 ? 'employee' : 'employees'} need attention this week
      </h2>
      <p className="mt-1 text-xs text-amber-900/80">
        Week of {weekStarting}. Projection assumes 8 h/day for remaining workdays. Based on loaded time cards (filter status may hide DRAFT entries).
      </p>
      <ul className="mt-2 space-y-1 text-sm text-amber-900">
        {attention.map((r) => {
          const e = empById.get(r.employeeId);
          const name = e ? fullName(e) : r.employeeId;
          const label =
            r.flag === 'DOUBLE_TIME_TODAY'
              ? `${r.longestDayHours.toFixed(1)} h on one day — double time`
              : r.flag === 'DAILY_OT_TODAY'
                ? `${r.longestDayHours.toFixed(1)} h on one day — daily OT`
                : r.flag === 'ALREADY_OVER_WEEKLY'
                  ? `${r.hoursWorkedSoFar.toFixed(1)} h logged so far — already past 40`
                  : `${r.hoursWorkedSoFar.toFixed(1)} h so far, ${r.projectedHoursThisWeek.toFixed(1)} h projected — will hit OT`;
          return (
            <li key={r.employeeId} className="font-medium">
              · {name} — {label}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
