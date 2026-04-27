// /materials — parts/inventory list with reorder + valuation rollup.

import Link from 'next/link';
import {
  computeInventoryRollup,
  formatUSD,
  isBelowReorder,
  materialCategoryLabel,
  type Material,
  type MaterialCategory,
} from '@yge/shared';

const CATEGORIES: MaterialCategory[] = [
  'AGGREGATE',
  'ASPHALT',
  'CONCRETE',
  'REBAR',
  'PIPE',
  'FITTING',
  'GEOTEXTILE',
  'EROSION_CONTROL',
  'SIGN',
  'PAINT',
  'WELDING',
  'FUEL',
  'LUBRICANT',
  'FASTENER',
  'SAFETY',
  'ELECTRICAL',
  'CONSUMABLE',
  'OTHER',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchMaterials(filter: {
  category?: string;
  belowReorder?: string;
}): Promise<Material[]> {
  const url = new URL(`${apiBaseUrl()}/api/materials`);
  if (filter.category) url.searchParams.set('category', filter.category);
  if (filter.belowReorder === 'true') url.searchParams.set('belowReorder', 'true');
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { materials: Material[] }).materials;
}
async function fetchAllMaterials(): Promise<Material[]> {
  const res = await fetch(`${apiBaseUrl()}/api/materials`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { materials: Material[] }).materials;
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { category?: string; belowReorder?: string };
}) {
  const [materials, all] = await Promise.all([
    fetchMaterials(searchParams),
    fetchAllMaterials(),
  ]);
  const rollup = computeInventoryRollup(all);

  function buildHref(overrides: Partial<{ category?: string; belowReorder?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.category) params.set('category', merged.category);
    if (merged.belowReorder === 'true') params.set('belowReorder', 'true');
    const q = params.toString();
    return q ? `/materials?${q}` : '/materials';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/materials/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + Add material
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Materials inventory</h1>
      <p className="mt-2 text-gray-700">
        Parts and consumables on hand. Stock movements are recorded in the
        ledger when material is received, consumed on a job, or returned.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="SKUs" value={rollup.total} />
        <Stat label="Below reorder" value={rollup.belowReorder} variant={rollup.belowReorder > 0 ? 'warn' : 'ok'} />
        <Stat label="Out of stock" value={rollup.outOfStock} variant={rollup.outOfStock > 0 ? 'bad' : 'ok'} />
        <Stat label="Inventory value" value={formatUSD(rollup.valuationCents)} />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Filter:</span>
        <Link
          href={buildHref({ category: undefined, belowReorder: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.category && searchParams.belowReorder !== 'true' ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        <Link
          href={buildHref({ belowReorder: searchParams.belowReorder === 'true' ? undefined : 'true' })}
          className={`rounded px-2 py-1 text-xs ${searchParams.belowReorder === 'true' ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          Below reorder
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={buildHref({ category: c })}
            className={`rounded px-2 py-1 text-xs ${searchParams.category === c ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {materialCategoryLabel(c)}
          </Link>
        ))}
      </section>

      {materials.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No materials match. Click <em>Add material</em> to add one.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">On hand</th>
                <th className="px-4 py-2">Reorder</th>
                <th className="px-4 py-2">Unit cost</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materials.map((m) => {
                const below = isBelowReorder(m);
                const out = m.quantityOnHand <= 0;
                const rowClass = out ? 'bg-red-50' : below ? 'bg-yellow-50' : '';
                return (
                  <tr key={m.id} className={rowClass}>
                    <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {materialCategoryLabel(m.category)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {m.sku ?? <span className="text-gray-400 font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {m.quantityOnHand} {m.unit}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {m.reorderPoint !== undefined ? `${m.reorderPoint} ${m.unit}` : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {m.unitCostCents !== undefined ? formatUSD(m.unitCostCents) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {m.location ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={`/materials/${m.id}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
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
