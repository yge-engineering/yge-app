// /wip — Work-in-Progress report.
//
// Plain English: per-job WIP report — contract, billed, paid, costs,
// %-complete, and over/under billing. The standard surety + CPA
// quarterly snapshot. Below the WIP table, an earned-value cost
// forecast: CPI < 1 means costs are running ahead of progress, FEAC
// is what the job will actually cost if it keeps trending the same.

import {
  AppShell,
  Money,
  PageHeader,
  ProgressBar,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
import {
  buildCostForecast,
  buildWipRow,
  computeWipRollup,
  type ApInvoice,
  type ArInvoice,
  type ArPayment,
  type ChangeOrder,
  type CostForecastFlag,
  type Job,
  type WipRow,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch { return []; }
}
async function fetchArInvoices(): Promise<ArInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
  } catch { return []; }
}
async function fetchArPayments(): Promise<ArPayment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-payments`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ArPayment[] }).payments;
  } catch { return []; }
}
async function fetchApInvoices(): Promise<ApInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ap-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ApInvoice[] }).invoices;
  } catch { return []; }
}
async function fetchChangeOrders(): Promise<ChangeOrder[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/change-orders`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { changeOrders: ChangeOrder[] }).changeOrders;
  } catch { return []; }
}

function forecastTint(flag: CostForecastFlag): string {
  if (flag === 'OVER_BUDGET') return 'bg-red-50';
  if (flag === 'AT_RISK') return 'bg-amber-50';
  if (flag === 'COMPLETE') return 'bg-gray-50 text-gray-500';
  return '';
}
function forecastTone(flag: CostForecastFlag): 'success' | 'warn' | 'danger' | 'muted' {
  switch (flag) {
    case 'ON_TRACK': return 'success';
    case 'AT_RISK': return 'warn';
    case 'OVER_BUDGET': return 'danger';
    case 'COMPLETE': return 'muted';
  }
}
function forecastLabel(flag: CostForecastFlag, t: Translator): string {
  switch (flag) {
    case 'ON_TRACK': return t('wip.forecast.flag.onTrack');
    case 'AT_RISK': return t('wip.forecast.flag.atRisk');
    case 'OVER_BUDGET': return t('wip.forecast.flag.over');
    case 'COMPLETE': return t('wip.forecast.flag.done');
  }
}

function parseDollarsToCents(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export default async function WipPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const [jobs, arInvoices, arPayments, apInvoices, changeOrders] = await Promise.all([
    fetchJobs(),
    fetchArInvoices(),
    fetchArPayments(),
    fetchApInvoices(),
    fetchChangeOrders(),
  ]);

  const activeJobIds = new Set<string>();
  for (const i of arInvoices) activeJobIds.add(i.jobId);
  for (const p of arPayments) activeJobIds.add(p.jobId);
  for (const ap of apInvoices) if (ap.jobId) activeJobIds.add(ap.jobId);
  for (const co of changeOrders) activeJobIds.add(co.jobId);

  const rows: WipRow[] = [];
  for (const job of jobs) {
    if (!activeJobIds.has(job.id)) continue;
    const contractKey = `contract.${job.id}`;
    const costKey = `cost.${job.id}`;
    const originalContractCents = parseDollarsToCents(searchParams[contractKey]);
    const estimatedCostAtCompletionCents = parseDollarsToCents(searchParams[costKey]);
    rows.push(
      buildWipRow({
        job,
        originalContractCents,
        estimatedCostAtCompletionCents,
        arInvoices: arInvoices.filter((i) => i.jobId === job.id),
        arPayments: arPayments.filter((p) => p.jobId === job.id),
        apInvoices: apInvoices.filter((ap) => ap.jobId === job.id),
        changeOrders: changeOrders.filter((co) => co.jobId === job.id),
      }),
    );
  }
  rows.sort((a, b) => b.adjustedContractCents - a.adjustedContractCents);
  const rollup = computeWipRollup(rows);
  const forecast = buildCostForecast(rows);
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title={t('wip.title')}
          subtitle={t('wip.subtitle')}
        />

        <section className="mb-3 grid gap-3 sm:grid-cols-4">
          <Tile label={t('wip.tile.jobs')} value={rollup.jobs} />
          <Tile label={t('wip.tile.adjustedContract')} value={<Money cents={rollup.totalAdjustedContractCents} />} />
          <Tile label={t('wip.tile.earnedRevenue')} value={<Money cents={rollup.totalEarnedRevenueCents} />} />
          <Tile label={t('wip.tile.costsIncurred')} value={<Money cents={rollup.totalCostsIncurredCents} />} />
        </section>

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('wip.tile.billed')} value={<Money cents={rollup.totalBilledCents} />} />
          <Tile label={t('wip.tile.collected')} value={<Money cents={rollup.totalCollectedCents} />} />
          <Tile
            label={t('wip.tile.overBilled')}
            value={<Money cents={rollup.totalOverBilledCents} />}
            tone={rollup.totalOverBilledCents > 0 ? 'warn' : 'success'}
          />
          <Tile
            label={t('wip.tile.underBilled')}
            value={<Money cents={rollup.totalUnderBilledCents} />}
            tone={rollup.totalUnderBilledCents > 0 ? 'danger' : 'success'}
          />
        </section>

        {rows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            {t('wip.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">{t('wip.col.job')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.contract')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.co')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.adjusted')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.costAtComplete')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.costToDate')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.percentComplete')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.earned')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.billed')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.collected')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.retention')}</th>
                  <th className="px-3 py-2 text-right">{t('wip.col.overUnder')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr
                    key={r.jobId}
                    className={
                      r.underBilledCents > 0 ? 'bg-red-50' : r.overBilledCents > 0 ? 'bg-amber-50' : ''
                    }
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{r.projectName}</div>
                      <div className="font-mono text-[10px] text-gray-500">{r.jobId}</div>
                    </td>
                    <td className="px-3 py-2 text-right"><Money cents={r.originalContractCents} /></td>
                    <td className="px-3 py-2 text-right"><Money cents={r.changeOrderTotalCents} /></td>
                    <td className="px-3 py-2 text-right"><Money cents={r.adjustedContractCents} className="font-semibold" /></td>
                    <td className="px-3 py-2 text-right"><Money cents={r.estimatedCostAtCompletionCents} /></td>
                    <td className="px-3 py-2 text-right"><Money cents={r.costsIncurredCents} /></td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex w-20 flex-col items-stretch align-middle">
                        <ProgressBar
                          value={r.percentComplete * 100}
                          max={100}
                          tone={r.percentComplete >= 0.95 ? 'success' : r.percentComplete >= 0.5 ? 'info' : 'neutral'}
                          size="sm"
                        />
                        <span className="mt-0.5 font-mono text-[10px] text-gray-700">
                          {(r.percentComplete * 100).toFixed(1)}%
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right"><Money cents={r.earnedRevenueCents} /></td>
                    <td className="px-3 py-2 text-right"><Money cents={r.billedToDateCents} /></td>
                    <td className="px-3 py-2 text-right"><Money cents={r.collectedToDateCents} /></td>
                    <td className="px-3 py-2 text-right"><Money cents={r.retentionHeldCents} /></td>
                    <td className="px-3 py-2 text-right">
                      {r.overBilledCents > 0 ? (
                        <span className="font-mono text-amber-800">+<Money cents={r.overBilledCents} /></span>
                      ) : r.underBilledCents > 0 ? (
                        <Money cents={-r.underBilledCents} className="font-semibold" />
                      ) : (
                        <span className="font-mono text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {forecast.rows.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-gray-900">{t('wip.forecast.heading')}</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">{t('wip.forecast.body')}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Tile
                label={t('wip.forecast.tile.cpi')}
                value={forecast.rollup.blendedCostPerformanceIndex.toFixed(2)}
                tone={
                  forecast.rollup.blendedCostPerformanceIndex < 0.85
                    ? 'danger'
                    : forecast.rollup.blendedCostPerformanceIndex < 0.95
                      ? 'warn'
                      : 'success'
                }
              />
              <Tile label={t('wip.forecast.tile.eac')} value={<Money cents={forecast.rollup.totalForecastEacCents} />} />
              <Tile label={t('wip.forecast.tile.etc')} value={<Money cents={forecast.rollup.totalCostToCompleteCents} />} />
              <Tile
                label={t('wip.forecast.tile.vac')}
                value={<Money cents={forecast.rollup.totalVarianceAtCompletionCents} />}
                tone={forecast.rollup.totalVarianceAtCompletionCents < 0 ? 'danger' : 'success'}
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-md border border-gray-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">{t('wip.col.job')}</th>
                    <th className="px-3 py-2 text-right">{t('wip.forecast.col.bac')}</th>
                    <th className="px-3 py-2 text-right">{t('wip.forecast.col.ac')}</th>
                    <th className="px-3 py-2 text-right">{t('wip.forecast.col.ev')}</th>
                    <th className="px-3 py-2 text-right">{t('wip.forecast.col.cpi')}</th>
                    <th className="px-3 py-2 text-right">{t('wip.forecast.col.feac')}</th>
                    <th className="px-3 py-2 text-right">{t('wip.forecast.col.etc')}</th>
                    <th className="px-3 py-2 text-right">{t('wip.forecast.col.vac')}</th>
                    <th className="px-3 py-2">{t('wip.forecast.col.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {forecast.rows.map((r) => (
                    <tr key={r.jobId} className={forecastTint(r.flag)}>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.projectName}</td>
                      <td className="px-3 py-2 text-right"><Money cents={r.budgetAtCompletionCents} /></td>
                      <td className="px-3 py-2 text-right"><Money cents={r.actualCostCents} /></td>
                      <td className="px-3 py-2 text-right"><Money cents={r.earnedValueCents} /></td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          r.costPerformanceIndex < 0.85
                            ? 'font-bold text-red-700'
                            : r.costPerformanceIndex < 0.95
                              ? 'text-amber-700'
                              : ''
                        }`}
                      >
                        {r.costPerformanceIndex.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right"><Money cents={r.forecastEacCents} /></td>
                      <td className="px-3 py-2 text-right"><Money cents={r.costToCompleteCents} /></td>
                      <td className="px-3 py-2 text-right">
                        <Money
                          cents={r.varianceAtCompletionCents}
                          className={r.varianceAtCompletionCents < 0 ? 'font-bold text-red-700' : ''}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill label={forecastLabel(r.flag, t)} tone={forecastTone(r.flag)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <p className="mt-4 text-xs text-gray-500">{t('wip.tip')}</p>
      </main>
    </AppShell>
  );
}
