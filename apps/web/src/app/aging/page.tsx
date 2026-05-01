// /aging — AR + AP aging dashboard.
//
// Two tables stacked: who owes us money (AR) and who we owe money to
// (AP). Both bucketed 0-30 / 31-60 / 61-90 / 90+. Worst offenders at
// the top. Defaults to today's date but accepts ?asOf=yyyy-mm-dd so
// month-end snapshots match what the bookkeeper sees in close.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  AGING_BUCKETS,
  buildApAgingReport,
  buildArAgingReport,
  formatUSD,
  type AgingBucket,
  type AgingReport,
  type ApInvoice,
  type ArInvoice,
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

export default async function AgingPage({
  searchParams,
}: {
  searchParams: { asOf?: string };
}) {
  const asOf =
    searchParams.asOf?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ??
    new Date().toISOString().slice(0, 10);

  const [arInvoices, apInvoices] = await Promise.all([
    fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
  ]);

  const ar = buildArAgingReport({ asOf, arInvoices });
  const ap = buildApAgingReport({ asOf, apInvoices });

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">AR + AP Aging</h1>
      <p className="mt-2 text-gray-700">
        Who owes us money, who we owe money to, bucketed by days past due.
        Anything in the 90+ column is the danger bucket — that&rsquo;s real
        money in trouble.
      </p>

      <form action="/aging" className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">As-of date</span>
          <input
            name="asOf"
            type="date"
            defaultValue={asOf}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Reload
        </button>
        <span className="text-xs text-gray-500">
          Snapshot as of {asOf}.
        </span>
      </form>

      {/* Summary cards — net AR-AP exposure at a glance. */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Open AR (money in)"
          value={formatUSD(ar.totalOpenCents)}
          variant={ar.hasDangerBucket ? 'bad' : 'ok'}
          sub={`${ar.rows.length} invoice${ar.rows.length === 1 ? '' : 's'}`}
        />
        <Stat
          label="Open AP (money out)"
          value={formatUSD(ap.totalOpenCents)}
          variant={ap.hasDangerBucket ? 'bad' : 'ok'}
          sub={`${ap.rows.length} bill${ap.rows.length === 1 ? '' : 's'}`}
        />
        <Stat
          label="Net working capital"
          value={formatUSD(ar.totalOpenCents - ap.totalOpenCents)}
          variant={
            ar.totalOpenCents - ap.totalOpenCents < 0 ? 'bad' : 'ok'
          }
          sub="AR open − AP open"
        />
      </section>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <a href="#ar" className="text-yge-blue-500 hover:underline">
          ↓ Receivables
        </a>
        <a href="#ap" className="text-yge-blue-500 hover:underline">
          ↓ Payables
        </a>
      </div>

      <section id="ar" className="mt-10 scroll-mt-8">
        <h2 className="text-xl font-bold text-gray-900">
          Receivables — who owes YGE
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Open customer invoices, by customer. Worst-90+ first. Caltrans + Cal
          Fire normally pay 30-45 days; anything past 60 means a packet got
          rejected upstream.
        </p>
        <PartyTable
          report={ar}
          partyHeader="Customer"
          empty="No open receivables. Nice."
        />
      </section>

      <section id="ap" className="mt-12 scroll-mt-8">
        <h2 className="text-xl font-bold text-gray-900">
          Payables — who YGE owes
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Open vendor bills, by vendor. Anything in 90+ is hurting our terms
          — flag for the next check run.
        </p>
        <PartyTable
          report={ap}
          partyHeader="Vendor"
          empty="No open payables."
        />
      </section>
    </main>
  );
}

function PartyTable({
  report,
  partyHeader,
  empty,
}: {
  report: AgingReport;
  partyHeader: string;
  empty: string;
}) {
  if (report.byParty.length === 0) {
    return (
      <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
        {empty}
      </div>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">{partyHeader}</th>
            <th className="px-3 py-2 text-right"># inv</th>
            {AGING_BUCKETS.map((b) => (
              <th key={b} className="px-3 py-2 text-right">
                {b} days
              </th>
            ))}
            <th className="px-3 py-2 text-right">Total open</th>
            <th className="px-3 py-2 text-right">Oldest</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {report.byParty.map((p) => (
            <tr
              key={p.partyName}
              className={p.bucket90PlusCents > 0 ? 'bg-red-50' : ''}
            >
              <td className="px-3 py-2 font-medium text-gray-900">{p.partyName}</td>
              <td className="px-3 py-2 text-right font-mono">{p.invoiceCount}</td>
              <td className="px-3 py-2 text-right font-mono">
                {p.bucket0to30Cents > 0 ? formatUSD(p.bucket0to30Cents) : '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {p.bucket31to60Cents > 0 ? formatUSD(p.bucket31to60Cents) : '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {p.bucket61to90Cents > 0 ? formatUSD(p.bucket61to90Cents) : '—'}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono ${
                  p.bucket90PlusCents > 0 ? 'font-bold text-red-700' : ''
                }`}
              >
                {p.bucket90PlusCents > 0 ? formatUSD(p.bucket90PlusCents) : '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold">
                {formatUSD(p.totalOpenCents)}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono text-xs ${
                  p.oldestDaysOverdue > 90
                    ? 'font-bold text-red-700'
                    : p.oldestDaysOverdue > 60
                      ? 'text-amber-700'
                      : 'text-gray-600'
                }`}
              >
                {p.oldestDaysOverdue > 0 ? `${p.oldestDaysOverdue}d` : 'current'}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-black bg-gray-50 font-semibold">
            <td className="px-3 py-3 uppercase tracking-wide">Totals</td>
            <td className="px-3 py-3 text-right font-mono">
              {report.rows.length}
            </td>
            {AGING_BUCKETS.map((b) => (
              <td key={b} className="px-3 py-3 text-right font-mono">
                {report.bucketTotals[b] > 0
                  ? formatUSD(report.bucketTotals[b])
                  : '—'}
              </td>
            ))}
            <td className="px-3 py-3 text-right font-mono">
              {formatUSD(report.totalOpenCents)}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  variant = 'ok',
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: 'ok' | 'warn' | 'bad';
}) {
  const valueClass =
    variant === 'bad'
      ? 'text-red-700'
      : variant === 'warn'
        ? 'text-amber-700'
        : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</div>
      {sub != null && (
        <div className="mt-1 text-xs text-gray-500">{sub}</div>
      )}
    </div>
  );
}

// `AgingBucket` import kept for future strict-mode tightening of the
// PartyTable column iterator.
export type { AgingBucket };
