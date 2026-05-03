// /cash-forecast — 12-week rolling cash projection.
//
// Plain English: AR receipts vs AP + payroll outflow over the next
// 12 weeks. Past-due AR collapses into Week 1 — invoices without an
// explicit due date assume invoice date + 30. Tells us if we're going
// to run dry before customer payments land.

import {
  Alert,
  AppShell,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
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
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title={t('cf.title')}
          subtitle={t('cf.subtitle')}
        />

        <form action="/cash-forecast" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">{t('cf.startingCash')}</span>
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
            <span className="mb-1 block font-medium text-gray-700">{t('cf.weeklyPayroll')}</span>
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
            {t('cf.recalculate')}
          </button>
        </form>

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('cf.tile.arIn')} value={<Money cents={forecast.totalArInflowCents} />} />
          <Tile
            label={t('cf.tile.apOut')}
            value={<Money cents={forecast.totalApOutflowCents} />}
            tone={forecast.totalApOutflowCents > 0 ? 'warn' : 'success'}
          />
          <Tile
            label={t('cf.tile.endingBalance')}
            value={<Money cents={forecast.endingBalanceCents} />}
            tone={forecast.endingBalanceCents < 0 ? 'danger' : 'success'}
          />
          <Tile
            label={t('cf.tile.negativeWeeks')}
            value={forecast.negativeWeekCount}
            tone={forecast.negativeWeekCount > 0 ? 'danger' : 'success'}
            warnText={forecast.negativeWeekCount > 0 ? t('cf.tile.warn') : undefined}
          />
        </section>

        {forecast.firstNegativeWeekIndex != null ? (
          <Alert tone="danger" title={t('cf.alert.title')} className="mb-4">
            {t('cf.alert.body', {
              week: forecast.firstNegativeWeekIndex + 1,
              date: forecast.weeks[forecast.firstNegativeWeekIndex]?.weekStart ?? '',
            })}
          </Alert>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">{t('cf.col.week')}</th>
                <th className="px-3 py-2">{t('cf.col.starts')}</th>
                <th className="px-3 py-2 text-right">{t('cf.col.arIn')}</th>
                <th className="px-3 py-2 text-right">{t('cf.col.apOut')}</th>
                <th className="px-3 py-2 text-right">{t('cf.col.payroll')}</th>
                <th className="px-3 py-2 text-right">{t('cf.col.net')}</th>
                <th className="px-3 py-2 text-right">{t('cf.col.running')}</th>
                <th className="px-3 py-2">{t('cf.col.detail')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forecast.weeks.map((w, i) => (
                <tr key={w.weekStart} className={w.runningCents < 0 ? 'bg-red-50' : ''}>
                  <td className="px-3 py-2 font-mono">{t('cf.weekPrefix')}{i + 1}</td>
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

        <p className="mt-4 text-xs text-gray-500">{t('cf.tip')}</p>
      </main>
    </AppShell>
  );
}
