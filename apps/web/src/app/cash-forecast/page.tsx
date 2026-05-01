// /cash-forecast — 12-week rolling cash projection.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  buildCashForecast,
  dollarsToCents,
  formatUSD,
  type ApInvoice,
  type ArInvoice,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAr(): Promise<ArInvoice[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
}
async function fetchAp(): Promise<ApInvoice[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ap-invoices`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { invoices: ApInvoice[] }).invoices;
}

export default async function CashForecastPage({
  searchParams,
}: {
  searchParams: { startCash?: string; payroll?: string };
}) {
  const [arInvoices, apInvoices] = await Promise.all([fetchAr(), fetchAp()]);
  const startingBalanceCents = dollarsToCents(Number(searchParams.startCash ?? '0') || 0);
  const weeklyPayrollCents = dollarsToCents(Number(searchParams.payroll ?? '0') || 0);

  const forecast = buildCashForecast({
    arInvoices,
    apInvoices,
    weeklyPayrollCents,
    startingBalanceCents,
  });

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Cash Flow Forecast</h1>
      <p className="mt-2 text-gray-700">
        12-week rolling projection of AR receipts vs AP + payroll outflow.
        Past-due AR collapses into Week 1 — invoices without an explicit due
        date assume invoice date + 30.
      </p>

      <form action="/cash-forecast" className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">Starting cash ($)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="startCash"
            defaultValue={searchParams.startCash ?? ''}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="250000.00"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">Weekly payroll ($)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="payroll"
            defaultValue={searchParams.payroll ?? ''}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="65000.00"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Recalculate
        </button>
      </form>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total AR inflow" value={formatUSD(forecast.totalArInflowCents)} />
        <Stat
          label="Total AP outflow"
          value={formatUSD(forecast.totalApOutflowCents)}
          variant={forecast.totalApOutflowCents > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="Ending balance"
          value={formatUSD(forecast.endingBalanceCents)}
          variant={forecast.endingBalanceCents < 0 ? 'bad' : 'ok'}
        />
        <Stat
          label="Negative weeks"
          value={forecast.negativeWeekCount}
          variant={forecast.negativeWeekCount > 0 ? 'bad' : 'ok'}
        />
      </section>

      {forecast.firstNegativeWeekIndex != null && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>First negative week:</strong> Week{' '}
          {forecast.firstNegativeWeekIndex + 1} (starting{' '}
          {forecast.weeks[forecast.firstNegativeWeekIndex]?.weekStart}).
          Running balance dips below zero — collect AR or delay AP before this
          date.
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Week</th>
              <th className="px-3 py-2">Starts</th>
              <th className="px-3 py-2 text-right">AR in</th>
              <th className="px-3 py-2 text-right">AP out</th>
              <th className="px-3 py-2 text-right">Payroll</th>
              <th className="px-3 py-2 text-right">Net</th>
              <th className="px-3 py-2 text-right">Running</th>
              <th className="px-3 py-2">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {forecast.weeks.map((w, i) => (
              <tr
                key={w.weekStart}
                className={w.runningCents < 0 ? 'bg-red-50' : ''}
              >
                <td className="px-3 py-2 font-mono">W{i + 1}</td>
                <td className="px-3 py-2 font-mono">{w.weekStart}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">
                  {w.arInflowCents > 0 ? formatUSD(w.arInflowCents) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-red-700">
                  {w.apOutflowCents > 0 ? formatUSD(w.apOutflowCents) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-red-700">
                  {w.payrollOutflowCents > 0 ? formatUSD(w.payrollOutflowCents) : '—'}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${
                    w.netCents < 0 ? 'text-red-700' : 'text-gray-700'
                  }`}
                >
                  {formatUSD(w.netCents)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono font-semibold ${
                    w.runningCents < 0 ? 'text-red-700' : 'text-gray-900'
                  }`}
                >
                  {formatUSD(w.runningCents)}
                </td>
                <td className="px-3 py-2 text-[10px] text-gray-600">
                  {w.arInvoices.length + w.apInvoices.length === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <>
                      {w.arInvoices.length > 0 && (
                        <div>{w.arInvoices.length} AR</div>
                      )}
                      {w.apInvoices.length > 0 && (
                        <div>{w.apInvoices.length} AP</div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Tip: pass <code className="rounded bg-gray-100 px-1">?startCash=N&amp;payroll=N</code>{' '}
        for a real projection. Numbers in dollars (e.g. <code>250000</code> + <code>65000</code>).
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
