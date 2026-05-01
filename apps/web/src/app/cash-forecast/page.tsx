// /cash-forecast — 12-week rolling cash projection.
//
// Plain English: AR receipts vs AP + payroll outflow over the next
// 12 weeks. Past-due AR collapses into Week 1 — invoices without an
// explicit due date assume invoice date + 30. Tells us if we're going
// to run dry before customer payments land.

import {
  AppShell,
  Card,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import {
  buildCashForecast,
  dollarsToCents,
  type ApInvoice,
  type ArInvoice,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAr(): Promise<ArInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
  } catch {
    return [];
  }
}
async function fetchAp(): Promise<ApInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ap-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ApInvoice[] }).invoices;
  } catch {
    return [];
  }
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
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title="Cash flow forecast"
          subtitle="12-week rolling projection. AR receipts vs AP + payroll outflow. Past-due AR collapses into Week 1; invoices without an explicit due date assume invoice date + 30."
        />

        <form action="/cash-forecast" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
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
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            Recalculate
          </button>
        </form>

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total AR inflow" value={<Money cents={forecast.totalArInflowCents} />} />
          <Tile
            label="Total AP outflow"
            value={<Money cents={forecast.totalApOutflowCents} />}
            tone={forecast.totalApOutflowCents > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="Ending balance"
            value={<Money cents={forecast.endingBalanceCents} />}
            tone={forecast.endingBalanceCents < 0 ? 'danger' : 'success'}
          />
          <Tile
            label="Negative weeks"
            value={forecast.negativeWeekCount}
            tone={forecast.negativeWeekCount > 0 ? 'danger' : 'success'}
            warnText={forecast.negativeWeekCount > 0 ? 'Cash dips below zero' : undefined}
          />
        </section>

        {forecast.firstNegativeWeekIndex != null ? (
          <Card className="mb-4 border-red-300 bg-red-50">
            <p className="text-sm text-red-900">
              <strong>First negative week:</strong> Week {forecast.firstNegativeWeekIndex + 1}{' '}
              (starting {forecast.weeks[forecast.firstNegativeWeekIndex]?.weekStart}). Running
              balance dips below zero — collect AR or delay AP before this date.
            </p>
          </Card>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
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
                <tr key={w.weekStart} className={w.runningCents < 0 ? 'bg-red-50' : ''}>
                  <td className="px-3 py-2 font-mono">W{i + 1}</td>
                  <td className="px-3 py-2 font-mono">{w.weekStart}</td>
                  <td className="px-3 py-2 text-right">
                    {w.arInflowCents > 0 ? <Money cents={w.arInflowCents} className="text-emerald-700" /> : <span className="font-mono text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {w.apOutflowCents > 0 ? <Money cents={w.apOutflowCents} className="text-red-700" /> : <span className="font-mono text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {w.payrollOutflowCents > 0 ? <Money cents={w.payrollOutflowCents} className="text-red-700" /> : <span className="font-mono text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money cents={w.netCents} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money cents={w.runningCents} className="font-semibold" />
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-600">
                    {w.arInvoices.length + w.apInvoices.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <>
                        {w.arInvoices.length > 0 ? <div>{w.arInvoices.length} AR</div> : null}
                        {w.apInvoices.length > 0 ? <div>{w.apInvoices.length} AP</div> : null}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Tip: pass <code className="rounded bg-gray-100 px-1 font-mono">?startCash=N&amp;payroll=N</code>{' '}
          for a real projection. Numbers in dollars (e.g. <code>250000</code> + <code>65000</code>).
        </p>
      </main>
    </AppShell>
  );
}
