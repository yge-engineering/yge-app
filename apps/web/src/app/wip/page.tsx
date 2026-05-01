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
  StatusPill,
  Tile,
} from '../../components';
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
function forecastLabel(flag: CostForecastFlag): string {
  switch (flag) {
    case 'ON_TRACK': return 'On track';
    case 'AT_RISK': return 'At risk';
    case 'OVER_BUDGET': return 'Over';
    case 'COMPLETE': return 'Done';
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

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title="Work-In-Progress"
          subtitle="Per-job WIP — contract, billed, paid, costs, %-complete, and over/under billing. The standard surety + CPA quarterly snapshot."
        />

        <section className="mb-3 grid gap-3 sm:grid-cols-4">
          <Tile label="Jobs" value={rollup.jobs} />
          <Tile label="Adjusted contract" value={<Money cents={rollup.totalAdjustedContractCents} />} />
          <Tile label="Earned revenue" value={<Money cents={rollup.totalEarnedRevenueCents} />} />
          <Tile label="Costs incurred" value={<Money cents={rollup.totalCostsIncurredCents} />} />
        </section>

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Billed to date" value={<Money cents={rollup.totalBilledCents} />} />
          <Tile label="Collected to date" value={<Money cents={rollup.totalCollectedCents} />} />
          <Tile
            label="Over-billed"
            value={<Money cents={rollup.totalOverBilledCents} />}
            tone={rollup.totalOverBilledCents > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="Under-billed"
            value={<Money cents={rollup.totalUnderBilledCents} />}
            tone={rollup.totalUnderBilledCents > 0 ? 'danger' : 'success'}
          />
        </section>

        {rows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            No active jobs with AR/AP/CO activity. Once you bill or post invoices to a job, it appears here.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
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
                    <td className="px-3 py-2 text-right font-mono">{(r.percentComplete * 100).toFixed(1)}%</td>
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
            <h2 className="text-xl font-bold text-gray-900">Cost forecast</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Earned-value projection per job. CPI &lt; 1 means costs are running ahead of progress —
              FEAC is what the job will actually cost if performance keeps trending the same way.
              Worst CPI first; finished jobs pinned to the bottom.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Tile
                label="Blended CPI"
                value={forecast.rollup.blendedCostPerformanceIndex.toFixed(2)}
                tone={
                  forecast.rollup.blendedCostPerformanceIndex < 0.85
                    ? 'danger'
                    : forecast.rollup.blendedCostPerformanceIndex < 0.95
                      ? 'warn'
                      : 'success'
                }
              />
              <Tile label="Forecast EAC" value={<Money cents={forecast.rollup.totalForecastEacCents} />} />
              <Tile label="Cost to complete" value={<Money cents={forecast.rollup.totalCostToCompleteCents} />} />
              <Tile
                label="Variance at completion"
                value={<Money cents={forecast.rollup.totalVarianceAtCompletionCents} />}
                tone={forecast.rollup.totalVarianceAtCompletionCents < 0 ? 'danger' : 'success'}
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-md border border-gray-200 bg-white">
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
                        <StatusPill label={forecastLabel(r.flag)} tone={forecastTone(r.flag)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <p className="mt-4 text-xs text-gray-500">
          Tip: until job records carry contract + cost-at-completion fields, append{' '}
          <code className="rounded bg-gray-100 px-1 font-mono">?contract.{'{'}jobId{'}'}=N&amp;cost.{'{'}jobId{'}'}=N</code>{' '}
          to project earned revenue + over/under billing per job. Numbers in dollars (e.g. <code>250000.00</code>).
        </p>
      </main>
    </AppShell>
  );
}
