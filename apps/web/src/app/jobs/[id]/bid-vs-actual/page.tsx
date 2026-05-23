// /jobs/[id]/bid-vs-actual — material bid vs. actual report.
//
// Different angle from /jobs/[id]/cost-variance: this page uses
// reconcileBidVsActual (bundle 2483) which buckets each bid line
// into ON_BUDGET / OVER_BUDGET / UNDER_BUDGET / UNTRACKED and
// surfaces UNBID SPEND (AP cost codes that aren't on the takeoff —
// added scope, missed scope, or miscoded AP).
//
// Same data sources as cost-variance: ImportedEstimate for the bid
// + AP invoices filtered to this job for the actuals.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  flaggedLines,
  reconcileBidVsActual,
  type ActualSpendLine,
  type ApInvoice,
  type BidLineForReconcile,
  type ImportedEstimate,
  type Job,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../../../components';
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

function fmtPct(p: number): string {
  if (!Number.isFinite(p)) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

const STATUS_TONE: Record<string, string> = {
  ON_BUDGET: 'bg-green-100 text-green-900',
  OVER_BUDGET: 'bg-red-100 text-red-900',
  UNDER_BUDGET: 'bg-blue-100 text-blue-900',
  UNTRACKED: 'bg-gray-100 text-gray-700',
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default async function JobBidVsActualPage({
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

  const [estimatesJson, apJson] = await Promise.all([
    fetchJson<{ importedEstimates: ImportedEstimate[] }>(
      `${apiBaseUrl()}/api/imported-estimates`,
    ),
    fetchJson<{ apInvoices: ApInvoice[] }>(
      `${apiBaseUrl()}/api/ap-invoices?jobId=${encodeURIComponent(job.id)}`,
    ),
  ]);

  const importedEstimate =
    estimatesJson?.importedEstimates.find((e) => e.jobId === job.id) ?? null;
  const apInvoices = apJson?.apInvoices ?? [];

  // Adapt the imported estimate lines into BidLineForReconcile[].
  // Skip lines without a cost code (caller's data hygiene problem;
  // reconcileBidVsActual would refuse them anyway).
  const bidLines: BidLineForReconcile[] = importedEstimate
    ? importedEstimate.lines
        .filter((l): l is typeof l & { costCode: string } => Boolean(l.costCode?.trim()))
        .map((l, idx) => ({
          id: `${importedEstimate.id}-${idx}`,
          costCode: l.costCode,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit ?? '',
          unitPriceCents: l.unitCostCents,
          totalCents: l.totalCostCents,
        }))
    : [];

  // Adapt AP invoice line items into ActualSpendLine[].
  const actuals: ActualSpendLine[] = apInvoices.flatMap((inv) =>
    (inv.lineItems ?? []).flatMap((li) => {
      // Some line items are not for this job — skip them.
      if (li.jobId && li.jobId !== job.id) return [];
      return [
        {
          invoiceId: inv.id,
          costCode: li.costCode,
          description: li.description,
          quantity: li.quantity,
          totalCents: li.lineTotalCents,
          postedOn: inv.invoiceDate,
        },
      ];
    }),
  );

  const report = reconcileBidVsActual(job.id, todayIso(), bidLines, actuals);
  const flagged = flaggedLines(report);

  const noData = bidLines.length === 0 && actuals.length === 0;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-4">
          <Link
            href={`/jobs/${encodeURIComponent(job.id)}`}
            className="text-sm text-yge-blue-500 hover:underline"
          >
            ← Back to job
          </Link>
        </div>

        <PageHeader
          title={`Bid vs actual — ${job.projectName ?? job.id}`}
          subtitle="Each bid takeoff line matched to AP spend by cost code. Status flags + unbid-spend bucket surface scope creep + miscoded AP."
        />

        {noData ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
            No imported estimate found for this job (or no AP yet). Link an
            estimate via the bid editor + post some AP, then re-run.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Tile label="Total bid" value={fmtMoney(report.totalBidCents)} />
              <Tile label="Total actual" value={fmtMoney(report.totalActualCents)} />
              <Tile
                label="Variance"
                value={`${fmtMoney(report.totalVarianceCents)} (${fmtPct(report.totalVariancePct)})`}
              />
              <Tile label="Flagged lines" value={String(flagged.length)} />
            </div>

            <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Bid line variance</h2>
              {report.lineVariances.length === 0 ? (
                <p className="mt-2 text-sm text-gray-600">
                  Estimate has no cost-coded lines yet.
                </p>
              ) : (
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-2">Cost code</th>
                      <th className="py-2">Description</th>
                      <th className="py-2 text-right">Bid</th>
                      <th className="py-2 text-right">Actual</th>
                      <th className="py-2 text-right">Variance</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.lineVariances.map((l) => (
                      <tr key={l.bidLineId} className="border-t border-gray-200">
                        <td className="py-2 font-mono text-xs text-gray-700">{l.costCode}</td>
                        <td className="py-2 text-gray-900">{l.description}</td>
                        <td className="py-2 text-right font-mono">{fmtMoney(l.bidTotalCents)}</td>
                        <td className="py-2 text-right font-mono">{fmtMoney(l.actualTotalCents)}</td>
                        <td
                          className={`py-2 text-right font-mono ${
                            l.costVarianceCents > 0
                              ? 'text-red-700'
                              : l.costVarianceCents < 0
                                ? 'text-blue-700'
                                : 'text-gray-700'
                          }`}
                        >
                          {fmtMoney(l.costVarianceCents)}
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[l.status] ?? ''}`}
                          >
                            {l.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {report.unbidSpend.length > 0 && (
              <section className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-amber-900">
                  Unbid spend ({report.unbidSpend.length} cost code{report.unbidSpend.length === 1 ? '' : 's'})
                </h2>
                <p className="mt-1 text-sm text-amber-900/80">
                  AP cost codes that aren't on the takeoff. Either added scope, missed scope on the bid, or miscoded AP.
                </p>
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-amber-900/70">
                    <tr>
                      <th className="py-2">Cost code</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="py-2">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.unbidSpend.map((u) => (
                      <tr key={u.costCode} className="border-t border-amber-200">
                        <td className="py-2 font-mono text-xs text-amber-900">{u.costCode}</td>
                        <td className="py-2 text-right font-mono text-amber-900">{fmtMoney(u.totalCents)}</td>
                        <td className="py-2 font-mono text-xs text-amber-900/80">
                          {u.invoiceIds.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}
