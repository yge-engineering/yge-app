// /jobs/[id]/cost-breakdown — per-cost-code drill-down for one job.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildJobCostBreakdown,
  findRateInEffect,
  formatUSD,
  type ApInvoice,
  type DirClassification,
  type DirRate,
  type Employee,
  type Expense,
  type Job,
  type JobCostCodeRow,
  type MileageEntry,
  type TimeCard,
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

async function fetchJob(id: string): Promise<Job | null> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return ((await res.json()) as { job: Job }).job;
}

export default async function CostBreakdownPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { county?: string };
}) {
  const job = await fetchJob(params.id);
  if (!job) notFound();
  const county = searchParams.county?.trim() || 'Shasta';

  const [apInvoices, expenses, timeCards, mileage, employees, dirRates] = await Promise.all([
    fetchJson<ApInvoice>(`/api/ap-invoices?jobId=${encodeURIComponent(job.id)}`, 'invoices'),
    fetchJson<Expense>(`/api/expenses?jobId=${encodeURIComponent(job.id)}`, 'expenses'),
    fetchJson<TimeCard>('/api/time-cards', 'cards'),
    fetchJson<MileageEntry>(`/api/mileage?jobId=${encodeURIComponent(job.id)}`, 'entries'),
    fetchJson<Employee>('/api/employees', 'employees'),
    fetchJson<DirRate>('/api/dir-rates', 'rates'),
  ]);

  // Index employee → classification + classification → base rate.
  const classificationByEmployeeId = new Map<string, DirClassification>();
  for (const e of employees) classificationByEmployeeId.set(e.id, e.classification);

  const asOf = new Date().toISOString().slice(0, 10);
  const laborRatesByClassification = new Map<DirClassification, number>();
  const classifications = new Set<DirClassification>(
    employees.map((e) => e.classification),
  );
  for (const c of classifications) {
    const rate = findRateInEffect(dirRates, { classification: c, county, asOf });
    if (rate) laborRatesByClassification.set(c, rate.basicHourlyCents);
  }

  const breakdown = buildJobCostBreakdown({
    jobId: job.id,
    apInvoices,
    expenses,
    timeCards,
    mileage,
    laborRatesByClassification,
    classificationByEmployeeId,
  });

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/jobs/${job.id}`}
          className="text-sm text-yge-blue-500 hover:underline"
        >
          &larr; {job.projectName}
        </Link>
        <span className="text-xs uppercase tracking-wide text-gray-500">
          Cost breakdown
        </span>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{job.projectName}</h1>
      <p className="mt-2 text-gray-700">
        Costs by cost code — AP invoice line items + time-card hours × DIR
        labor rate + reimbursable expenses + mileage. Uncoded items roll into
        the bottom bucket.
      </p>

      <form action={`/jobs/${job.id}/cost-breakdown`} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">Labor rate county</span>
          <input
            name="county"
            defaultValue={county}
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

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Cost codes" value={breakdown.rows.length} />
        <Stat label="Total actual" value={formatUSD(breakdown.totalActualCents)} />
        <Stat
          label="Budget vs actual"
          value={
            breakdown.hasBudget
              ? formatUSD((breakdown.totalBudgetCents ?? 0) - breakdown.totalActualCents)
              : 'n/a'
          }
        />
      </section>

      {!breakdown.hasBudget && (
        <p className="mt-4 text-xs text-gray-500">
          No budget loaded for this job. Budget vs actual variance lights up once
          bid items grow a cost-code field (Phase 2) and the awarded estimate
          for this job has cost codes assigned.
        </p>
      )}

      {breakdown.rows.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No costs coded to this job yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Cost code</th>
                <th className="px-3 py-2 text-right">AP</th>
                <th className="px-3 py-2 text-right">Labor</th>
                <th className="px-3 py-2 text-right">Expense</th>
                <th className="px-3 py-2 text-right">Mileage</th>
                <th className="px-3 py-2 text-right">Actual</th>
                <th className="px-3 py-2 text-right">Budget</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2 text-right">Var %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {breakdown.rows.map((r) => (
                <Row key={r.costCode} row={r} />
              ))}
              <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                <td className="px-3 py-3 text-right uppercase tracking-wide">
                  Totals
                </td>
                <td colSpan={4} className="px-3 py-3"></td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatUSD(breakdown.totalActualCents)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {breakdown.totalBudgetCents != null ? formatUSD(breakdown.totalBudgetCents) : '—'}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {breakdown.totalBudgetCents != null
                    ? formatUSD(breakdown.totalBudgetCents - breakdown.totalActualCents)
                    : '—'}
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

function Row({ row }: { row: JobCostCodeRow }) {
  const overBudget =
    row.varianceCents != null && row.varianceCents < 0;
  const cls = overBudget ? 'bg-red-50' : '';
  return (
    <tr className={cls}>
      <td className="px-3 py-2 font-mono text-sm">{row.costCode}</td>
      <td className="px-3 py-2 text-right font-mono">
        {row.apCents > 0 ? formatUSD(row.apCents) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {row.laborCents > 0 ? formatUSD(row.laborCents) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {row.expenseCents > 0 ? formatUSD(row.expenseCents) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {row.mileageCents > 0 ? formatUSD(row.mileageCents) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono font-semibold">
        {formatUSD(row.totalActualCents)}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {row.budgetCents != null ? formatUSD(row.budgetCents) : '—'}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono ${
          overBudget ? 'font-bold text-red-700' : ''
        }`}
      >
        {row.varianceCents != null ? formatUSD(row.varianceCents) : '—'}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono text-xs ${
          overBudget ? 'font-bold text-red-700' : 'text-gray-600'
        }`}
      >
        {row.variancePercent != null ? `${(row.variancePercent * 100).toFixed(1)}%` : '—'}
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
