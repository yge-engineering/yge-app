// /wip — Work-in-Progress report.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  buildCostForecast,
  buildWipRow,
  computeWipRollup,
  formatUSD,
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
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}
async function fetchArInvoices(): Promise<ArInvoice[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
}
async function fetchArPayments(): Promise<ArPayment[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ar-payments`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { payments: ArPayment[] }).payments;
}
async function fetchApInvoices(): Promise<ApInvoice[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ap-invoices`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { invoices: ApInvoice[] }).invoices;
}
async function fetchChangeOrders(): Promise<ChangeOrder[]> {
  const res = await fetch(`${apiBaseUrl()}/api/change-orders`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { changeOrders: ChangeOrder[] }).changeOrders;
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

  // Only include jobs that have any AR/AP/CO activity.
  const activeJobIds = new Set<string>();
  for (const i of arInvoices) activeJobIds.add(i.jobId);
  for (const p of arPayments) activeJobIds.add(p.jobId);
  for (const ap of apInvoices) if (ap.jobId) activeJobIds.add(ap.jobId);
  for (const co of changeOrders) activeJobIds.add(co.jobId);

  const rows: WipRow[] = [];
  for (const job of jobs) {
    if (!activeJobIds.has(job.id)) continue;
    // contract value + cost-at-completion are caller-supplied via URL
    // until we wire them to awarded estimates: ?contract.<jobId>=12345.67
    // and ?cost.<jobId>=10000.00
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

  return (
    <AppShell>
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Work-In-Progress</h1>
      <p className="mt-2 text-gray-700">
        Per-job WIP report — contract, billed, paid, costs, %-complete, and
        over/under billing. The standard surety + CPA quarterly snapshot.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Jobs" value={rollup.jobs} />
        <Stat
          label="Adjusted contract"
          value={formatUSD(rollup.totalAdjustedContractCents)}
        />
        <Stat
          label="Earned revenue"
          value={formatUSD(rollup.totalEarnedRevenueCents)}
        />
        <Stat
          label="Costs incurred"
          value={formatUSD(rollup.totalCostsIncurredCents)}
        />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Billed to date" value={formatUSD(rollup.totalBilledCents)} />
        <Stat label="Collected to date" value={formatUSD(rollup.totalCollectedCents)} />
        <Stat
          label="Over-billed"
          value={formatUSD(rollup.totalOverBilledCents)}
          variant={rollup.totalOverBilledCents > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="Under-billed"
          value={formatUSD(rollup.totalUnderBilledCents)}
          variant={rollup.totalUnderBilledCents > 0 ? 'bad' : 'ok'}
        />
      </section>

      {rows.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No active jobs with AR/AP/CO activity. Once you bill or post invoices
          to a job, it appears here.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2 text-right">Contract</th>
                <th className="px-3 py-2 text-right">CO</th>
                <th className="px-3 py-2 text-right">Adjusted</th>
                <th className="px-3 py-2 text-right">Cost @ Compl.</th>
                <th className="px-3 py-2 text-right">Cost To Date</th>
                <th className="px-3 py-2 text-right">% Compl.</th>
                <th className="px-3 py-2 text-right">Earned</th>
                <th className="px-3 py-2 text-right">Billed</th>
                <th className="px-3 py-2 text-right">Collected</th>
                <th className="px-3 py-2 text-right">Retention</th>
                <th className="px-3 py-2 text-right">Over/Under</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr
                  key={r.jobId}
                  className={
                    r.underBilledCents > 0
                      ? 'bg-red-50'
                      : r.overBilledCents > 0
                        ? 'bg-yellow-50'
                        : ''
                  }
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{r.projectName}</div>
                    <div className="font-mono text-[10px] text-gray-500">{r.jobId}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatUSD(r.originalContractCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatUSD(r.changeOrderTotalCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatUSD(r.adjustedContractCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatUSD(r.estimatedCostAtCompletionCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatUSD(r.costsIncurredCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {(r.percentComplete * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatUSD(r.earnedRevenueCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatUSD(r.billedToDateCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatUSD(r.collectedToDateCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatUSD(r.retentionHeldCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.overBilledCents > 0 ? (
                      <span className="text-yellow-800">
                        +{formatUSD(r.overBilledCents)}
                      </span>
                    ) : r.underBilledCents > 0 ? (
                      <span className="font-semibold text-red-700">
                        −{formatUSD(r.underBilledCents)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {forecast.rows.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">Cost Forecast</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Earned-value projection per job. CPI &lt; 1 means costs are
            running ahead of progress — FEAC is what the job will actually
            cost if performance keeps trending the same way. Worst CPI
            first; finished jobs pinned to the bottom.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <Stat
              label="Blended CPI"
              value={forecast.rollup.blendedCostPerformanceIndex.toFixed(2)}
              variant={
                forecast.rollup.blendedCostPerformanceIndex < 0.85
                  ? 'bad'
                  : forecast.rollup.blendedCostPerformanceIndex < 0.95
                    ? 'warn'
                    : 'ok'
              }
            />
            <Stat
              label="Forecast EAC"
              value={formatUSD(forecast.rollup.totalForecastEacCents)}
            />
            <Stat
              label="Cost to complete"
              value={formatUSD(forecast.rollup.totalCostToCompleteCents)}
            />
            <Stat
              label="Variance at completion"
              value={formatUSD(forecast.rollup.totalVarianceAtCompletionCents)}
              variant={
                forecast.rollup.totalVarianceAtCompletionCents < 0
                  ? 'bad'
                  : 'ok'
              }
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2 text-right">BAC</th>
                  <th className="px-3 py-2 text-right">AC</th>
                  <th className="px-3 py-2 text-right">EV</th>
                  <th className="px-3 py-2 text-right">CPI</th>
                  <th className="px-3 py-2 text-right">FEAC</th>
                  <th className="px-3 py-2 text-right">ETC</th>
                  <th className="px-3 py-2 text-right">VAC</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {forecast.rows.map((r) => (
                  <tr key={r.jobId} className={forecastTint(r.flag)}>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.projectName}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUSD(r.budgetAtCompletionCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUSD(r.actualCostCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUSD(r.earnedValueCents)}
                    </td>
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
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUSD(r.forecastEacCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUSD(r.costToCompleteCents)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono ${
                        r.varianceAtCompletionCents < 0
                          ? 'font-bold text-red-700'
                          : ''
                      }`}
                    >
                      {formatUSD(r.varianceAtCompletionCents)}
                    </td>
                    <td className="px-3 py-2">
                      <ForecastBadge flag={r.flag} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Tip: until job records carry contract + cost-at-completion fields,
        append <code className="rounded bg-gray-100 px-1">?contract.{'{'}jobId{'}'}=N&amp;cost.{'{'}jobId{'}'}=N</code>{' '}
        to project earned revenue + over/under billing per job. Numbers in
        dollars (e.g. <code>250000.00</code>).
      </p>
    </main>
    </AppShell>
  );
}

function forecastTint(flag: CostForecastFlag): string {
  if (flag === 'OVER_BUDGET') return 'bg-red-50';
  if (flag === 'AT_RISK') return 'bg-amber-50';
  if (flag === 'COMPLETE') return 'bg-gray-50 text-gray-500';
  return '';
}

function ForecastBadge({ flag }: { flag: CostForecastFlag }) {
  const styles: Record<CostForecastFlag, string> = {
    OVER_BUDGET: 'bg-red-100 text-red-800',
    AT_RISK: 'bg-amber-100 text-amber-800',
    ON_TRACK: 'bg-green-100 text-green-800',
    COMPLETE: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<CostForecastFlag, string> = {
    OVER_BUDGET: 'Over',
    AT_RISK: 'At risk',
    ON_TRACK: 'On track',
    COMPLETE: 'Done',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[flag]}`}>
      {labels[flag]}
    </span>
  );
}

function parseDollarsToCents(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
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
