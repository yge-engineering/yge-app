// /job-profit — per-job profitability roll-up.
//
// Plain English: revenue vs costs by job, sorted bleeders-first so the
// jobs that need attention surface at the top. Pulls billed AR,
// approved/paid AP, executed COs, and out-of-pocket expenses + mileage
// coded to each job. The whole point is to keep "this job is losing
// money" visible while there's still time to do something about it.

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
import {
  buildJobProfitRows,
  computeJobProfitRollup,
  sortJobProfitRowsBleedersFirst,
  type ApInvoice,
  type ArInvoice,
  type ChangeOrder,
  type Expense,
  type Job,
  type JobProfitRow,
  type MileageEntry,
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

export default async function JobProfitPage() {
  const [jobs, arInvoices, apInvoices, changeOrders, expenses, mileage] = await Promise.all([
    fetchJson<Job>('/api/jobs', 'jobs'),
    fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
    fetchJson<ChangeOrder>('/api/change-orders', 'changeOrders'),
    fetchJson<Expense>('/api/expenses', 'expenses'),
    fetchJson<MileageEntry>('/api/mileage', 'entries'),
  ]);

  const rows = sortJobProfitRowsBleedersFirst(
    buildJobProfitRows({ jobs, arInvoices, apInvoices, changeOrders, expenses, mileage }),
  );
  const rollup = computeJobProfitRollup(rows);
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title={t('jobProfit.title')}
          subtitle={t('jobProfit.subtitle')}
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('jobProfit.tile.activeJobs')} value={rollup.jobs} />
          <Tile
            label={t('jobProfit.tile.blendedGp')}
            value={<Money cents={rollup.totalGrossProfitCents} />}
            tone={rollup.totalGrossProfitCents < 0 ? 'danger' : 'success'}
          />
          <Tile
            label={t('jobProfit.tile.blendedMargin')}
            value={`${(rollup.blendedMargin * 100).toFixed(1)}%`}
            tone={rollup.blendedMargin < 0 ? 'danger' : rollup.blendedMargin < 0.1 ? 'warn' : 'success'}
          />
          <Tile
            label={t('jobProfit.tile.unprofitable')}
            value={rollup.unprofitableJobs}
            tone={rollup.unprofitableJobs > 0 ? 'danger' : 'success'}
          />
        </section>

        {rows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            {t('jobProfit.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">{t('jobProfit.col.job')}</th>
                  <th className="px-3 py-2">{t('jobProfit.col.status')}</th>
                  <th className="px-3 py-2 text-right">{t('jobProfit.col.revenue')}</th>
                  <th className="px-3 py-2 text-right">{t('jobProfit.col.co')}</th>
                  <th className="px-3 py-2 text-right">{t('jobProfit.col.ap')}</th>
                  <th className="px-3 py-2 text-right">{t('jobProfit.col.exp')}</th>
                  <th className="px-3 py-2 text-right">{t('jobProfit.col.mile')}</th>
                  <th className="px-3 py-2 text-right">{t('jobProfit.col.totalCost')}</th>
                  <th className="px-3 py-2 text-right">{t('jobProfit.col.gp')}</th>
                  <th className="px-3 py-2 text-right">{t('jobProfit.col.margin')}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <ProfitRow key={r.jobId} row={r} t={t} />
                ))}
                <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-3 py-3 text-right uppercase tracking-wide">{t('jobProfit.totals')}</td>
                  <td className="px-3 py-3 text-right"><Money cents={rollup.totalRevenueCents} /></td>
                  <td className="px-3 py-3 text-right">—</td>
                  <td colSpan={3} className="px-3 py-3 text-right">—</td>
                  <td className="px-3 py-3 text-right"><Money cents={rollup.totalCostsCents} className="font-semibold" /></td>
                  <td className="px-3 py-3 text-right">
                    <Money
                      cents={rollup.totalGrossProfitCents}
                      className={`font-semibold ${rollup.totalGrossProfitCents < 0 ? 'text-red-700' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{(rollup.blendedMargin * 100).toFixed(1)}%</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function ProfitRow({ row, t }: { row: JobProfitRow; t: Translator }) {
  const negative = row.grossProfitCents < 0;
  const thin = !negative && row.grossMargin < 0.1;
  const cls = negative ? 'bg-red-50' : thin ? 'bg-amber-50' : '';
  return (
    <tr className={cls}>
      <td className="px-3 py-2">
        <Link href={`/jobs/${row.jobId}`} className="font-medium text-blue-700 hover:underline">
          {row.projectName}
        </Link>
        <div className="font-mono text-[10px] text-gray-500">{row.jobId}</div>
      </td>
      <td className="px-3 py-2 text-[10px] uppercase tracking-wide text-gray-700">{row.status}</td>
      <td className="px-3 py-2 text-right">
        <Money cents={row.revenueBilledCents} />
        {row.revenueOutstandingCents > 0 ? (() => {
          // Split-and-fill: keep the inline <Money/> in the localized
          // 'owed' suffix template.
          const tpl = t('jobProfit.owed', { amount: '__AMT__' });
          const [pre, post] = tpl.split('__AMT__');
          return (
            <div className="text-[10px] text-gray-500">
              {pre}<Money cents={row.revenueOutstandingCents} />{post}
            </div>
          );
        })() : null}
      </td>
      <td className="px-3 py-2 text-right">
        {row.changeOrderTotalCents !== 0 ? <Money cents={row.changeOrderTotalCents} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        {row.costsByCategory.apCents > 0 ? <Money cents={row.costsByCategory.apCents} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        {row.costsByCategory.expenseCents > 0 ? <Money cents={row.costsByCategory.expenseCents} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        {row.costsByCategory.mileageCents > 0 ? <Money cents={row.costsByCategory.mileageCents} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        <Money cents={row.totalCostsCents} className="font-semibold" />
      </td>
      <td className="px-3 py-2 text-right">
        <Money cents={row.grossProfitCents} className={`font-semibold ${negative ? 'text-red-700' : ''}`} />
      </td>
      <td
        className={`px-3 py-2 text-right font-mono ${
          negative ? 'font-bold text-red-700' : thin ? 'text-amber-800' : ''
        }`}
      >
        {(row.grossMargin * 100).toFixed(1)}%
      </td>
      <td className="px-3 py-2 text-right text-sm">
        <Link href={`/jobs/${row.jobId}/binder`} className="text-blue-700 hover:underline">
          {t('jobProfit.binder')}
        </Link>
      </td>
    </tr>
  );
}
