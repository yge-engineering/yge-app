// /close-checklist — month-end close runbook.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  buildCloseChecklist,
  severityLabel,
  type ApInvoice,
  type ApPayment,
  type ArInvoice,
  type CloseCheckItem,
  type DailyReport,
  type JournalEntry,
  type SwpppInspection,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const body = (await res.json()) as Record<string, unknown>;
  const arr = body[key];
  return Array.isArray(arr) ? (arr as T[]) : [];
}

function defaultMonth(): string {
  // Default to the most-recently-completed month.
  const now = new Date();
  // First day of the current month, then back up one day.
  const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return `${lastMonthEnd.getUTCFullYear()}-${String(lastMonthEnd.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function CloseChecklistPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? '')
    ? (searchParams.month as string)
    : defaultMonth();

  const [
    journalEntries,
    arInvoices,
    apInvoices,
    apPayments,
    dailyReports,
    swpppInspections,
  ] = await Promise.all([
    fetchJson<JournalEntry>('/api/journal-entries', 'entries'),
    fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
    fetchJson<ApPayment>('/api/ap-payments', 'payments'),
    fetchJson<DailyReport>('/api/daily-reports', 'reports'),
    fetchJson<SwpppInspection>('/api/swppp-inspections', 'inspections'),
  ]);

  const checklist = buildCloseChecklist({
    month,
    journalEntries,
    arInvoices,
    apInvoices,
    apPayments,
    dailyReports,
    swpppInspections,
  });

  return (
    <AppShell>
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Month-end Close</h1>
      <p className="mt-2 text-gray-700">
        Single-page runbook for closing the books on a given month. Blockers
        must be cleared before close; advisories are nudges to follow up.
      </p>

      <form
        action="/close-checklist"
        className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
      >
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">Month</span>
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Reload
        </button>
      </form>

      <div
        className={`mt-4 rounded border p-3 text-sm ${
          checklist.readyToClose
            ? 'border-green-300 bg-green-50 text-green-900'
            : 'border-red-300 bg-red-50 text-red-900'
        }`}
      >
        <strong>
          {checklist.readyToClose
            ? `✓ Ready to close ${checklist.month}`
            : `✗ ${checklist.blockerCount} blocker${checklist.blockerCount === 1 ? '' : 's'} before closing ${checklist.month}`}
        </strong>
        {checklist.warnCount > 0 && (
          <span className="ml-2 text-xs">
            ({checklist.warnCount} advisor{checklist.warnCount === 1 ? 'y' : 'ies'})
          </span>
        )}
      </div>

      <article className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="border-b border-gray-300 pb-2 text-center">
          <h2 className="text-lg font-bold uppercase">Close Runbook</h2>
          <p className="text-sm">
            Period: {checklist.monthStart} through {checklist.monthEnd}
          </p>
        </header>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-xs uppercase tracking-wide text-gray-500">
              <th className="px-2 py-1 text-left">Check</th>
              <th className="w-24 px-2 py-1 text-center">Severity</th>
              <th className="w-20 px-2 py-1 text-center">Status</th>
              <th className="w-12 px-2 py-1 text-center">Init</th>
            </tr>
          </thead>
          <tbody>
            {checklist.items.map((it) => (
              <ItemRow key={it.id} item={it} />
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="font-semibold uppercase">Closed by</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
            <div className="mt-1 text-gray-600">Print + sign</div>
          </div>
          <div>
            <div className="font-semibold uppercase">Closed on</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
          </div>
        </div>
      </article>
    </main>
    </AppShell>
  );
}

function ItemRow({ item }: { item: CloseCheckItem }) {
  const rowCls =
    item.status === 'FAIL'
      ? 'bg-red-50'
      : item.status === 'WARN'
        ? 'bg-yellow-50'
        : '';
  return (
    <tr className={`border-b border-gray-200 align-top ${rowCls}`}>
      <td className="px-2 py-2">
        <div className="font-medium text-gray-900">
          {item.href ? (
            <Link href={item.href} className="text-yge-blue-500 hover:underline">
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </div>
        <div className="text-xs text-gray-600">{item.detail}</div>
      </td>
      <td className="px-2 py-2 text-center">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${
            item.severity === 'BLOCKER'
              ? 'bg-red-100 text-red-800'
              : item.severity === 'ADVISORY'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {severityLabel(item.severity)}
        </span>
      </td>
      <td className="px-2 py-2 text-center">
        {item.status === 'PASS' ? (
          <span className="font-bold text-green-700">PASS</span>
        ) : item.status === 'WARN' ? (
          <span className="font-semibold text-yellow-800">WARN</span>
        ) : (
          <span className="font-bold text-red-700">FAIL</span>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <span className="inline-block min-w-[2.5rem] border-b border-gray-400">
          &nbsp;
        </span>
      </td>
    </tr>
  );
}
