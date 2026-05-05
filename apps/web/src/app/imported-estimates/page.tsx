// /imported-estimates — list of estimates imported from YGE Excel.

import Link from 'next/link';
import type { ImportedEstimate } from '@yge/shared';

import { AppShell, PageHeader } from '../../components';

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
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Job #</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2 text-right">Direct</th>
                  <th className="px-3 py-2 text-right">O&amp;P</th>
                  <th className="px-3 py-2 text-right">Bid</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estimates.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{e.jobNumber}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/imported-estimates/${e.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {e.projectName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{e.client ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{e.rateType}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmtMoney(e.directCostCents)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmtMoney(e.oppMarkupCents)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{fmtMoney(e.bidPriceCents)}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      {e.lines.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
