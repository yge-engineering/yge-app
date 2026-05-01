// /jobs/[id]/cost-breakdown — per-cost-code drill-down for one job.
//
// Plain English: costs by cost code — AP invoice line items + time-card
// hours × DIR labor rate + reimbursable expenses + mileage. Uncoded
// items roll into the bottom bucket so nothing slips by uncategorized.

import { notFound } from 'next/navigation';

import {
  AppShell,
  Money,
  PageHeader,
  Tile,
} from '../../../../components';
import {
  buildJobCostBreakdown,
  findRateInEffect,
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
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch { return []; }
}

async function fetchJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return ((await res.json()) as { job: Job }).job;
  } catch { return null; }
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

  const variance = breakdown.hasBudget
    ? (breakdown.totalBudgetCents ?? 0) - breakdown.totalActualCents
    : null;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={job.projectName}
          subtitle="Costs by cost code — AP invoice line items + time-card hours × DIR labor rate + reimbursable expenses + mileage. Uncoded items roll into the bottom bucket."
          back={{ href: `/jobs/${job.id}`, label: `← ${job.projectName}` }}
        />

        <form action={`/jobs/${job.id}/cost-breakdown`} className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Labor rate county</span>
            <input
              name="county"
              defaultValue={county}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
            Reload
          </button>
        </form>

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Tile label="Cost codes" value={breakdown.rows.length} />
          <Tile label="Total actual" value={<Money cents={breakdown.totalActualCents} />} />
          <Tile
            label="Budget vs actual"
            value={breakdown.hasBudget && variance !== null ? <Money cents={variance} /> : 'n/a'}
            tone={variance !== null && variance < 0 ? 'danger' : 'neutral'}
          />
        </section>

        {!breakdown.hasBudget ? (
          <p className="mb-4 text-xs text-gray-500">
            No budget loaded for this job. Budget vs actual variance lights up once bid items grow
            a cost-code field (Phase 2) and the awarded estimate for this job has cost codes assigned.
          </p>
        ) : null}

        {breakdown.rows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            No costs coded to this job yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
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
                  <td className="px-3 py-3 text-right uppercase tracking-wide">Totals</td>
                  <td colSpan={4} className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-right"><Money cents={breakdown.totalActualCents} /></td>
                  <td className="px-3 py-3 text-right">
                    {breakdown.totalBudgetCents != null
                      ? <Money cents={breakdown.totalBudgetCents} />
                      : <span className="font-mono text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {variance !== null
                      ? <Money cents={variance} />
                      : <span className="font-mono text-gray-400">—</span>}
                  </td>
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

function Row({ row }: { row: JobCostCodeRow }) {
  const overBudget = row.varianceCents != null && row.varianceCents < 0;
  const cls = overBudget ? 'bg-red-50' : '';
  return (
    <tr className={cls}>
      <td className="px-3 py-2 font-mono text-sm">{row.costCode}</td>
      <td className="px-3 py-2 text-right">
        {row.apCents > 0 ? <Money cents={row.apCents} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        {row.laborCents > 0 ? <Money cents={row.laborCents} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        {row.expenseCents > 0 ? <Money cents={row.expenseCents} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        {row.mileageCents > 0 ? <Money cents={row.mileageCents} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        <Money cents={row.totalActualCents} className="font-semibold" />
      </td>
      <td className="px-3 py-2 text-right">
        {row.budgetCents != null
          ? <Money cents={row.budgetCents} />
          : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        {row.varianceCents != null
          ? <Money cents={row.varianceCents} className={overBudget ? 'font-bold text-red-700' : ''} />
          : <span className="font-mono text-gray-400">—</span>}
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
