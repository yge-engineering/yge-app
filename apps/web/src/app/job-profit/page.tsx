// /job-profit — per-job profitability roll-up.

import Link from 'next/link';
import {
  buildJobProfitRows,
  computeJobProfitRollup,
  formatUSD,
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
  const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const body = (await res.json()) as Record<string, unknown>;
  const arr = body[key];
  return Array.isArray(arr) ? (arr as T[]) : [];
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
    buildJobProfitRows({
      jobs,
      arInvoices,
      apInvoices,
      changeOrders,
      expenses,
      mileage,
    }),
  );
  const rollup = computeJobProfitRollup(rows);

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Job Profitability</h1>
      <p className="mt-2 text-gray-700">
        Per-job revenue vs costs, sorted bleeders-first so the jobs that need
        attention surface at the top. Pulls billed AR, approved/paid AP,
        executed COs, and out-of-pocket expenses + mileage coded to each job.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Active jobs" value={rollup.jobs} />
        <Stat
          label="Blended GP"
          value={formatUSD(rollup.totalGrossProfitCents)}
          variant={rollup.totalGrossProfitCents < 0 ? 'bad' : 'ok'}
        />
        <Stat
          label="Blended margin"
          value={`${(rollup.blendedMargin * 100).toFixed(1)}%`}
          variant={rollup.blendedMargin < 0 ? 'bad' : rollup.blendedMargin < 0.1 ? 'warn' : 'ok'}
        />
        <Stat
          label="Unprofitable jobs"
          value={rollup.unprofitableJobs}
          variant={rollup.unprofitableJobs > 0 ? 'bad' : 'ok'}
        />
      </section>

      {rows.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No active jobs with AR / AP / CO activity. Once you bill an invoice
          or post a vendor bill against a job, it shows up here.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">CO</th>
                <th className="px-3 py-2 text-right">AP</th>
                <th className="px-3 py-2 text-right">Exp</th>
                <th className="px-3 py-2 text-right">Mile</th>
                <th className="px-3 py-2 text-right">Total cost</th>
                <th className="px-3 py-2 text-right">GP</th>
                <th className="px-3 py-2 text-right">Margin</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <ProfitRow key={r.jobId} row={r} />
              ))}
              <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                <td colSpan={2} className="px-3 py-3 text-right uppercase tracking-wide">
                  Totals
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatUSD(rollup.totalRevenueCents)}
                </td>
                <td className="px-3 py-3 text-right">—</td>
                <td colSpan={3} className="px-3 py-3 text-right">—</td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatUSD(rollup.totalCostsCents)}
                </td>
                <td
                  className={`px-3 py-3 text-right font-mono ${
                    rollup.totalGrossProfitCents < 0 ? 'text-red-700' : ''
                  }`}
                >
                  {formatUSD(rollup.totalGrossProfitCents)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {(rollup.blendedMargin * 100).toFixed(1)}%
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function ProfitRow({ row }: { row: JobProfitRow }) {
  const negative = row.grossProfitCents < 0;
  const thin = !negative && row.grossMargin < 0.1;
  const cls = negative ? 'bg-red-50' : thin ? 'bg-yellow-50' : '';
  return (
    <tr className={cls}>
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900">{row.projectName}</div>
        <div className="font-mono text-[10px] text-gray-500">{row.jobId}</div>
      </td>
      <td className="px-3 py-2 text-[10px] uppercase tracking-wide text-gray-700">
        {row.status}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {formatUSD(row.revenueBilledCents)}
        {row.revenueOutstandingCents > 0 && (
          <div className="text-[10px] text-gray-500">
            {formatUSD(row.revenueOutstandingCents)} owed
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {row.changeOrderTotalCents !== 0 ? formatUSD(row.changeOrderTotalCents) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {row.costsByCategory.apCents > 0 ? formatUSD(row.costsByCategory.apCents) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {row.costsByCategory.expenseCents > 0 ? formatUSD(row.costsByCategory.expenseCents) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {row.costsByCategory.mileageCents > 0 ? formatUSD(row.costsByCategory.mileageCents) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono font-semibold">
        {formatUSD(row.totalCostsCents)}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono font-semibold ${
          negative ? 'text-red-700' : ''
        }`}
      >
        {formatUSD(row.grossProfitCents)}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono ${
          negative ? 'font-bold text-red-700' : thin ? 'text-yellow-800' : ''
        }`}
      >
        {(row.grossMargin * 100).toFixed(1)}%
      </td>
      <td className="px-3 py-2 text-right text-sm">
        <Link
          href={`/jobs/${row.jobId}/binder`}
          className="text-yge-blue-500 hover:underline"
        >
          Binder
        </Link>
      </td>
    </tr>
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
