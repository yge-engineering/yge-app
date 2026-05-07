// /imported-estimates — list of estimates imported from YGE Excel.

import Link from 'next/link';
import { EstimatesSortHeaders } from '../../components/estimates-sort-headers';
import { JobsShortcutsChip } from '../../components/jobs-shortcuts-chip';
import { EstimatesSearchInput } from '../../components/estimates-search-input';
import { CopyMoneyButton } from '../../components/copy-money-button';
import type { ImportedEstimate } from '@yge/shared';

import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
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
  const estimates = await fetchEstimates();
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
              <EstimatesSearchInput targetId="imported-list-table" totalCount={estimates.length} />
              <EstimatesSortHeaders targetId="imported-list-table" />
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table id="imported-list-table" className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
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
                      <Link
                        href={`/imported-estimates/${e.id}`}
                        className="font-medium text-gray-900 hover:text-yge-blue-700 hover:underline"
                      >
                        {e.projectName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{e.client ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{e.rateType}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmtMoney(e.directCostCents)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmtMoney(e.oppMarkupCents)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold"><CopyMoneyButton cents={e.bidPriceCents}>{fmtMoney(e.bidPriceCents)}</CopyMoneyButton></td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      {e.lines.length}
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
