// /close-checklist — month-end close runbook.

import Link from 'next/link';

import { Alert, AppShell } from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
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
  const t = getTranslator();

  return (
    <AppShell>
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('cc.title')}</h1>
      <p className="mt-2 text-gray-700">{t('cc.subtitle')}</p>

      <form
        action="/close-checklist"
        className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
      >
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">{t('cc.month')}</span>
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
          {t('cc.reload')}
        </button>
      </form>

      <Alert tone={checklist.readyToClose ? 'success' : 'danger'} className="mt-4">
        <strong>
          {checklist.readyToClose
            ? t('cc.alert.ready', { month: checklist.month })
            : t('cc.alert.blockers', { count: checklist.blockerCount, plural: checklist.blockerCount === 1 ? '' : 's', month: checklist.month })}
        </strong>
        {checklist.warnCount > 0 && (
          <span className="ml-2 text-xs">
            {t('cc.alert.advisorySuffix', { count: checklist.warnCount, plural: checklist.warnCount === 1 ? 'y' : 'ies' })}
          </span>
        )}
      </Alert>

      <article className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="border-b border-gray-300 pb-2 text-center">
          <h2 className="text-lg font-bold uppercase">{t('cc.runbook')}</h2>
          <p className="text-sm">{t('cc.period', { start: checklist.monthStart, end: checklist.monthEnd })}</p>
        </header>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-xs uppercase tracking-wide text-gray-500">
              <th className="px-2 py-1 text-left">{t('cc.col.check')}</th>
              <th className="w-24 px-2 py-1 text-center">{t('cc.col.severity')}</th>
              <th className="w-20 px-2 py-1 text-center">{t('cc.col.status')}</th>
              <th className="w-12 px-2 py-1 text-center">{t('cc.col.init')}</th>
            </tr>
          </thead>
          <tbody>
            {checklist.items.map((it) => (
              <ItemRow key={it.id} item={it} t={t} />
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="font-semibold uppercase">{t('cc.signoff.closedBy')}</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
            <div className="mt-1 text-gray-600">{t('cc.signoff.printSign')}</div>
          </div>
          <div>
            <div className="font-semibold uppercase">{t('cc.signoff.closedOn')}</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
          </div>
        </div>
      </article>
    </main>
    </AppShell>
  );
}

function ItemRow({ item, t }: { item: CloseCheckItem; t: Translator }) {
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
          <span className="font-bold text-green-700">{t('cc.status.pass')}</span>
        ) : item.status === 'WARN' ? (
          <span className="font-semibold text-yellow-800">{t('cc.status.warn')}</span>
        ) : (
          <span className="font-bold text-red-700">{t('cc.status.fail')}</span>
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
