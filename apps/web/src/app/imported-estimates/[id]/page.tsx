// /imported-estimates/[id] — detail view: line items grouped by section.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  groupLinesBySection,
  importedEstimateLineCategoryLabel,
  type ImportedEstimate,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../../components';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEstimate(id: string): Promise<ImportedEstimate | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/imported-estimates/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { importedEstimate?: ImportedEstimate };
    return body.importedEstimate ?? null;
  } catch {
    return null;
  }
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMoneyCompact(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function ImportedEstimateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const estimate = await fetchEstimate(params.id);
  if (!estimate) notFound();
  const sections = groupLinesBySection(estimate.lines);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <div className="mb-2">
          <Link
            href="/imported-estimates"
            className="text-xs text-blue-700 hover:underline"
          >
            ← All imported estimates
          </Link>
        </div>
        <PageHeader
          title={estimate.projectName}
          subtitle={`Job ${estimate.jobNumber} · ${estimate.client ?? 'Client TBD'} · ${estimate.rateType}`}
        />

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Direct cost" value={fmtMoneyCompact(estimate.directCostCents)} />
          <Stat
            label={`O&P markup (${(estimate.oppPercent * 100).toFixed(0)}%)`}
            value={fmtMoneyCompact(estimate.oppMarkupCents)}
          />
          <Stat label="Bid price" value={fmtMoneyCompact(estimate.bidPriceCents)} primary />
        </div>

        {sections.map((sec) => {
          const sectionDirect = sec.lines.reduce((s, l) => s + l.totalCostCents, 0);
          const sectionBid = sec.lines.reduce((s, l) => s + l.bidPriceCents, 0);
          return (
            <div key={sec.sectionName} className="mb-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-300 pb-1">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                  {sec.sectionName}
                </h3>
                <div className="text-xs text-gray-500">
                  Direct {fmtMoneyCompact(sectionDirect)} · Bid {fmtMoneyCompact(sectionBid)}
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">Category</th>
                      <th className="px-2 py-1.5">Code</th>
                      <th className="px-2 py-1.5">Description</th>
                      <th className="px-2 py-1.5 text-right">Qty</th>
                      <th className="px-2 py-1.5">Unit</th>
                      <th className="px-2 py-1.5 text-right">Unit cost</th>
                      <th className="px-2 py-1.5 text-right">Total</th>
                      <th className="px-2 py-1.5 text-right">Bid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sec.lines.map((l, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-xs text-gray-500">{l.itemNumber ?? '—'}</td>
                        <td className="px-2 py-1.5 text-xs">
                          {importedEstimateLineCategoryLabel(l.category)}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs">{l.costCode ?? '—'}</td>
                        <td className="px-2 py-1.5">
                          {l.description}
                          {l.notes && (
                            <div className="text-[11px] italic text-gray-500">{l.notes}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs">
                          {l.quantity}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-gray-500">{l.unit ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs">
                          {fmtMoney(l.unitCostCents)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs">
                          {fmtMoney(l.totalCostCents)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs font-semibold">
                          {fmtMoney(l.bidPriceCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </main>
    </AppShell>
  );
}

function Stat({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div
      className={`rounded-lg border ${primary ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'} p-3`}
    >
      <div className="text-[10px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${primary ? 'text-blue-900' : 'text-gray-900'}`}
      >
        {value}
      </div>
    </div>
  );
}
