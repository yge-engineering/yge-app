// /imported-estimates — list of estimates imported from YGE Excel.

import Link from 'next/link';
import { EstimatesSortHeaders } from '../../components/estimates-sort-headers';
import { JobsShortcutsChip } from '../../components/jobs-shortcuts-chip';
import { EstimatesSearchInput } from '../../components/estimates-search-input';
import { EstimatesKeyboardNav } from '../../components/estimates-keyboard-nav';
import { CopyMoneyButton } from '../../components/copy-money-button';
import type { ImportedEstimate } from '@yge/shared';

import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAudits() {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/imported-estimates/audits-summary`, { cache: 'no-store' });
    if (!res.ok) return [] as Array<{ id: string; low: number; med: number; high: number; total: number }>;
    const body = (await res.json()) as { summary?: Array<{ id: string; low: number; med: number; high: number; total: number }> };
    return body.summary ?? [];
  } catch {
    return [] as Array<{ id: string; low: number; med: number; high: number; total: number }>;
  }
}

async function fetchBidResults() {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' });
    if (!res.ok) return [] as Array<{ jobId: string; outcome: string }>;
    const body = (await res.json()) as { results?: Array<{ jobId: string; outcome: string }> };
    return body.results ?? [];
  } catch {
    return [] as Array<{ jobId: string; outcome: string }>;
  }
}

async function fetchEstimates(): Promise<ImportedEstimate[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/imported-estimates`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { importedEstimates?: ImportedEstimate[] };
    return body.importedEstimates ?? [];
  } catch {
    return [];
  }
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function ImportedEstimatesPage() {
  requirePermission('estimates:view');
  const [estimates, bidResults, audits] = await Promise.all([fetchEstimates(), fetchBidResults(), fetchAudits()]);
  const auditByEstimateId = new Map<string, { low: number; med: number; high: number; total: number }>();
  for (const a of audits) auditByEstimateId.set(a.id, a);
  const outcomeByJobId = new Map<string, string>();
  for (const r of bidResults) outcomeByJobId.set(r.jobId, r.outcome);
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Imported estimates"
          subtitle={`${estimates.length} estimate${estimates.length === 1 ? '' : 's'} imported from YGE Excel`}
        />
        {estimates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-gray-700">
              No imported estimates yet.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Run scripts/import-from-excel.py to load estimates from the
              Excel master.
            </p>
          </div>
        ) : (
          <div>
            <div id="imported-list-print-controls" className="print:hidden">
              <div className="mb-2 flex items-center justify-end">
                <JobsShortcutsChip />
              </div>
              <EstimatesSearchInput targetId="imported-list-table" totalCount={estimates.length} />
              <div className="mb-2 flex justify-end">
                <Link
                  href="/imported-estimates/compare"
                  className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50"
                >
                  Compare two estimates →
                </Link>
                <Link
                  href="/imported-estimates/search"
                  className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50"
                >
                  Search bids →
                </Link>
              </div>
              <EstimatesSortHeaders targetId="imported-list-table" />
            </div>
            <EstimatesKeyboardNav targetId="imported-list-table" />
            <div className="rounded-lg border border-gray-200 bg-white">
            <table id="imported-list-table" className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Job #</th>
                  <th data-sort-key="name" className="select-none px-3 py-2 hover:bg-gray-100">
                    Project
                    <span className="sort-arrow" />
                  </th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2 text-right">Direct</th>
                  <th className="px-3 py-2 text-right">O&amp;P</th>
                  <th data-sort-key="cents" className="select-none px-3 py-2 text-right hover:bg-gray-100">
                    Bid
                    <span className="sort-arrow" />
                  </th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estimates.map((e) => (
                  <tr
                    key={e.id}
                    data-search={`${e.projectName} ${e.client ?? ''} ${e.jobNumber}`}
                    data-sort-name={e.projectName.toLowerCase()}
                    data-sort-cents={e.bidPriceCents}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{e.jobNumber}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/imported-estimates/${e.id}`}
                          className="font-medium text-gray-900 hover:text-yge-blue-700 hover:underline"
                        >
                          {e.projectName}
                        </Link>
                        {(() => {
                          const a = auditByEstimateId.get(e.id);
                          if (!a) return null;
                          const score = a.high * 3 + a.med;
                          if (score === 0) return null;
                          const tone = a.high > 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800';
                          return (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                              title={`Price audit: ${a.high} high, ${a.med} medium, ${a.low} low`}
                            >
                              ⚠ {a.total}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{e.client ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{e.rateType}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmtMoney(e.directCostCents)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmtMoney(e.oppMarkupCents)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold"><CopyMoneyButton cents={e.bidPriceCents}>{fmtMoney(e.bidPriceCents)}</CopyMoneyButton></td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      {e.lines.length}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {(() => {
                        if (!e.jobId) return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">Pending</span>;
                        const o = outcomeByJobId.get(e.jobId);
                        if (!o) return <span className="rounded-full bg-yge-blue-100 px-2 py-0.5 text-yge-blue-800">Active job</span>;
                        if (o === 'WON_BY_YGE') return <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800 font-semibold">Won</span>;
                        if (o === 'WON_BY_OTHER') return <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">Lost</span>;
                        if (o === 'NO_AWARD') return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">No award</span>;
                        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">TBD</span>;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
