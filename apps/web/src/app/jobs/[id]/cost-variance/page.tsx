// /jobs/[id]/cost-variance — bid vs actual per cost code.
//
// Plain English: same idea as the "Cost Code Variance" sheet in the
// YGE Excel. For one job, shows every cost code with its BID totals
// from the linked imported estimate and ACTUAL totals from AP invoice
// line items, plus the variance.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  computeCostVariance,
  rollupCostVariance,
  type ApInvoice,
  type CostCode,
  type ImportedEstimate,
  type Job,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../../../components';
import { requirePermission } from '../../../../lib/permissions';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function fmtMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPct(p: number | null): string {
  if (p === null) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

export default async function CostVariancePage({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('financials:view');
  const jobJson = await fetchJson<{ job: Job }>(
    `${apiBaseUrl()}/api/jobs/${params.id}`,
  );
  if (!jobJson?.job) notFound();
  const job = jobJson.job;

  const [estimatesJson, apJson, ccJson] = await Promise.all([
    fetchJson<{ importedEstimates: ImportedEstimate[] }>(
      `${apiBaseUrl()}/api/imported-estimates`,
    ),
    fetchJson<{ apInvoices: ApInvoice[] }>(
      `${apiBaseUrl()}/api/ap-invoices?jobId=${encodeURIComponent(job.id)}`,
    ),
    fetchJson<{ costCodes: CostCode[] }>(`${apiBaseUrl()}/api/cost-codes`),
  ]);

  const importedEstimate =
    estimatesJson?.importedEstimates.find((e) => e.jobId === job.id) ?? null;
  const apInvoices = apJson?.apInvoices ?? [];
  const costCodes = ccJson?.costCodes ?? [];

  const rows = computeCostVariance({
    jobId: job.id,
    importedEstimate,
    apInvoices,
    costCodes,
  });
  const totals = rollupCostVariance(rows);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <div className="mb-2 text-xs">
          <Link href={`/jobs/${job.id}`} className="text-blue-700 hover:underline">
            ← Back to {job.projectName}
          </Link>
        </div>
        <PageHeader
          title="Cost Code Variance"
          subtitle={`${job.projectName} · Bid vs actual per code`}
        />

        <section className="mb-6 grid gap-3 sm:grid-cols-4">
          <Stat label="Bid total" value={fmtMoney(totals.bidTotalCents)} />
          <Stat label="Actual to date" value={fmtMoney(totals.actualTotalCents)} />
          <Stat
            label="Variance ($)"
            value={fmtMoney(totals.varianceCents)}
            tone={totals.varianceCents >= 0 ? 'good' : 'bad'}
          />
          <Stat
            label="Variance (%)"
            value={fmtPct(totals.variancePercent)}
            tone={
              totals.variancePercent === null
                ? undefined
                : totals.variancePercent >= 0
                  ? 'good'
                  : 'bad'
            }
          />
        </section>

        {!importedEstimate && (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            No imported estimate is linked to this job — Bid columns will be
            empty until one is. Open the estimate at /imported-estimates and
            link it to this job.
          </div>
        )}

        <p className="mb-2 text-xs text-gray-500">
          Actual data is pulled from AP invoices linked to this job. Labor
          actuals (from time cards) require an employee-rate join and will
          appear here when payroll syncs.
        </p>

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-2 py-2">Cost Code</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2 text-right">Bid Qty</th>
                <th className="px-2 py-2 text-right">Bid Unit $</th>
                <th className="px-2 py-2 text-right">Bid Total</th>
                <th className="px-2 py-2 text-right">Actual</th>
                <th className="px-2 py-2 text-right">Variance $</th>
                <th className="px-2 py-2 text-right">Variance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-8 text-center text-sm text-gray-400">
                    No cost codes touched on this job yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isOver = r.varianceCents < 0;
                  const noActivity = r.bidTotalCents === 0 && r.actualTotalCents === 0;
                  return (
                    <tr
                      key={r.costCode}
                      className={`hover:bg-gray-50 ${noActivity ? 'opacity-50' : ''}`}
                    >
                      <td className="px-2 py-1.5 font-mono text-xs">{r.costCode}</td>
                      <td className="px-2 py-1.5">{r.description ?? '—'}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-500">
                        {r.category ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">
                        {r.bidQuantity || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">
                        {r.bidUnitCostCents ? fmtMoney(r.bidUnitCostCents) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">
                        {fmtMoney(r.bidTotalCents)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">
                        {fmtMoney(r.actualTotalCents)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-mono text-xs font-semibold ${
                          noActivity
                            ? ''
                            : isOver
                              ? 'text-red-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {fmtMoney(r.varianceCents)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-mono text-xs ${
                          r.variancePercent === null
                            ? 'text-gray-400'
                            : r.variancePercent < 0
                              ? 'text-red-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {fmtPct(r.variancePercent)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : tone === 'bad'
        ? 'border-red-300 bg-red-50 text-red-900'
        : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border ${toneClass} p-3`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
