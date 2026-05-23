import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, Money, PageHeader } from '../../../components';
import {
  computeDepreciationSchedule,
  fixedAssetCategoryLabel,
  type FixedAsset,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchAsset(id: string): Promise<FixedAsset | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/fixed-assets/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return ((await res.json()) as { asset: FixedAsset }).asset;
  } catch {
    return null;
  }
}

export default async function FixedAssetDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const asset = await fetchAsset(params.id);
  if (!asset) notFound();
  const sched = computeDepreciationSchedule(asset);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-8">
        <div className="mb-6">
          <Link href="/fixed-assets" className="text-sm text-yge-blue-500 hover:underline">
            ← Back to assets
          </Link>
        </div>

        <PageHeader title={asset.name} subtitle={fixedAssetCategoryLabel(asset.category)} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-gray-200 bg-white p-4">
            <Row label="Category" value={fixedAssetCategoryLabel(asset.category)} />
            {asset.vendorName ? <Row label="Vendor" value={asset.vendorName} /> : null}
            {asset.equipmentId ? (
              <Row
                label="Equipment"
                value={
                  <Link href={`/equipment/${asset.equipmentId}`} className="font-mono text-xs text-blue-700 hover:underline">
                    {asset.equipmentId}
                  </Link>
                }
              />
            ) : null}
            <Row label="Acquired on" value={<span className="font-mono">{asset.acquiredOn}</span>} />
            <Row label="Placed in service" value={<span className="font-mono">{asset.placedInServiceOn}</span>} />
            <Row label="Useful life" value={`${asset.usefulLifeYears} yr`} />
            {asset.disposedOn ? <Row label="Disposed on" value={asset.disposedOn} /> : null}
            {asset.notes ? <Row label="Notes" value={asset.notes} multiline /> : null}
          </div>
          <div className="rounded border border-gray-200 bg-white p-4">
            <Row label="Method" value={<span className="font-mono">{asset.method.replace(/_/g, ' ')}</span>} />
            <Row label="Acquired cost" value={<Money cents={asset.acquiredCostCents} />} />
            <Row label="Salvage value" value={<Money cents={asset.salvageValueCents} />} />
            <Row label="Lifetime depreciation" value={<Money cents={sched.totalDepreciationCents} />} />
            {asset.method === 'BONUS_DEPRECIATION' ? (
              <Row label="Bonus %" value={`${Math.round(asset.bonusPercentage * 100)}%`} />
            ) : null}
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
            Depreciation schedule
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Year</th>
                <th className="px-4 py-2 text-right font-semibold">Depreciation</th>
                <th className="px-4 py-2 text-right font-semibold">Ending book value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sched.years.map((y) => (
                <tr key={y.year}>
                  <td className="px-4 py-2 font-mono text-sm">{y.year}</td>
                  <td className="px-4 py-2 text-right">
                    <Money cents={y.depreciationCents} />
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    <Money cents={y.endingBookValueCents} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </AppShell>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="mb-2 grid grid-cols-[140px_1fr] items-start gap-3 last:mb-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={multiline ? 'whitespace-pre-wrap text-sm text-gray-900' : 'text-sm text-gray-900'}>
        {value}
      </div>
    </div>
  );
}
