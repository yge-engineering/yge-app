// /materials — parts/inventory list with reorder + valuation rollup.
//
// Plain English: parts and consumables on hand. Stock movements are
// recorded in the ledger when material is received, consumed on a job,
// or returned. The reorder + out-of-stock signals at the top tell
// purchasing what to chase first.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  computeInventoryRollup,
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
  try {
    const url = new URL(`${apiBaseUrl()}/api/materials`);
    if (filter.category) url.searchParams.set('category', filter.category);
    if (filter.belowReorder === 'true') url.searchParams.set('belowReorder', 'true');
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { materials: Material[] }).materials;
  } catch {
    return [];
  }
}
async function fetchAllMaterials(): Promise<Material[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/materials`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { materials: Material[] }).materials;
  } catch {
    return [];
  }
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
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('materials.title')}
          subtitle={t('materials.subtitle')}
          actions={
            <LinkButton href="/materials/new" variant="primary" size="md">
              {t('materials.addMaterial')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('materials.tile.skus')} value={rollup.total} />
          <Tile
            label={t('materials.tile.belowReorder')}
            value={rollup.belowReorder}
            tone={rollup.belowReorder > 0 ? 'warn' : 'success'}
          />
          <Tile
            label={t('materials.tile.outOfStock')}
            value={rollup.outOfStock}
            tone={rollup.outOfStock > 0 ? 'danger' : 'success'}
          />
          <Tile label={t('materials.tile.value')} value={<Money cents={rollup.valuationCents} />} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('materials.filter.label')}</span>
          <Link
            href={buildHref({ category: undefined, belowReorder: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.category && searchParams.belowReorder !== 'true' ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('materials.filter.all')}
          </Link>
          <Link
            href={buildHref({ belowReorder: searchParams.belowReorder === 'true' ? undefined : 'true' })}
            className={`rounded px-2 py-1 text-xs ${searchParams.belowReorder === 'true' ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('materials.filter.belowReorder')}
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={buildHref({ category: c })}
              className={`rounded px-2 py-1 text-xs ${searchParams.category === c ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {materialCategoryLabel(c)}
            </Link>
          ))}
        </section>

        {materials.length === 0 ? (
          <EmptyState
            title={t('materials.empty.title')}
            body={t('materials.empty.body')}
            actions={[{ href: '/materials/new', label: t('materials.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={materials}
            keyFn={(m) => m.id}
            columns={[
              {
                key: 'name',
                header: t('materials.col.name'),
                cell: (m) => (
                  <Link href={`/materials/${m.id}`} className="font-medium text-blue-700 hover:underline">
                    {m.name}
                  </Link>
                ),
              },
              { key: 'category', header: t('materials.col.category'), cell: (m) => <span className="text-xs text-gray-700">{materialCategoryLabel(m.category)}</span> },
              {
                key: 'sku',
                header: t('materials.col.sku'),
                cell: (m) => m.sku ? <span className="font-mono text-sm text-gray-700">{m.sku}</span> : <span className="text-sm text-gray-400">—</span>,
              },
              {
                key: 'onHand',
                header: t('materials.col.onHand'),
                cell: (m) => {
                  const out = m.quantityOnHand <= 0;
                  const below = isBelowReorder(m);
                  return (
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{m.quantityOnHand} {m.unit}</span>
                      {out ? <StatusPill label={t('materials.status.out')} tone="danger" /> : below ? <StatusPill label={t('materials.status.low')} tone="warn" /> : null}
                    </span>
                  );
                },
              },
              {
                key: 'reorder',
                header: t('materials.col.reorder'),
                cell: (m) => m.reorderPoint !== undefined ? <span className="text-xs text-gray-700">{m.reorderPoint} {m.unit}</span> : <span className="text-xs text-gray-400">—</span>,
              },
              {
                key: 'unitCost',
                header: t('materials.col.unitCost'),
                cell: (m) => m.unitCostCents !== undefined ? <Money cents={m.unitCostCents} /> : <span className="text-sm text-gray-400">—</span>,
              },
              {
                key: 'location',
                header: t('materials.col.location'),
                cell: (m) => m.location ? <span className="text-xs text-gray-700">{m.location}</span> : <span className="text-xs text-gray-400">—</span>,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
