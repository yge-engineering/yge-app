import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import { StatementCsvButton } from '../../components/statement-csv-button';
import { requirePermission } from '../../lib/permissions';
import {
  computeDepreciationSchedule,
  fixedAssetCategoryLabel,
  type FixedAsset,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchAssets(): Promise<FixedAsset[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/fixed-assets`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { assets: FixedAsset[] }).assets;
  } catch {
    return [];
  }
}

export default async function FixedAssetsPage() {
  requirePermission('financials:view');
  const assets = await fetchAssets();
  const totalCost = assets.reduce((s, a) => s + a.acquiredCostCents, 0);
  const totalLifetimeDepreciation = assets.reduce(
    (s, a) => s + computeDepreciationSchedule(a).totalDepreciationCents,
    0,
  );

  const csvRows: Array<Array<string | number>> = assets.map((a) => [
    a.name,
    fixedAssetCategoryLabel(a.category),
    a.method,
    a.acquiredOn,
    (a.acquiredCostCents / 100).toFixed(2),
    (a.salvageValueCents / 100).toFixed(2),
    a.usefulLifeYears,
  ]);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Fixed asset register"
          subtitle="Tax-side depreciation tracking — kept separate from operational equipment so the CPA's schedule and the field's service history don't fight each other."
          actions={
            <span className="flex gap-2">
              <StatementCsvButton
                filename="fixed-assets.csv"
                headers={['Name', 'Category', 'Method', 'Acquired', 'Cost', 'Salvage', 'Life (yr)']}
                rows={csvRows}
              />
              <LinkButton href="/fixed-assets/new" variant="primary" size="md">
                + New asset
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Tile label="Assets" value={assets.length} />
          <Tile label="Acquired cost (total)" value={<Money cents={totalCost} />} />
          <Tile label="Lifetime depreciation" value={<Money cents={totalLifetimeDepreciation} />} />
        </section>

        {assets.length === 0 ? (
          <EmptyState
            title="No assets yet"
            body="Add an asset to start tracking depreciation."
          />
        ) : (
          <DataTable
            rows={assets}
            columns={[
              {
                key: 'name',
                header: 'Name',
                cell: (a) => (
                  <Link
                    href={`/fixed-assets/${a.id}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    {a.name}
                  </Link>
                ),
              },
              {
                key: 'cat',
                header: 'Category',
                cell: (a) => <span className="text-xs text-gray-700">{fixedAssetCategoryLabel(a.category)}</span>,
              },
              {
                key: 'method',
                header: 'Method',
                cell: (a) => <span className="font-mono text-xs">{a.method.replace(/_/g, ' ')}</span>,
              },
              {
                key: 'acq',
                header: 'Acquired',
                cell: (a) => <span className="font-mono text-xs">{a.acquiredOn}</span>,
              },
              {
                key: 'cost',
                header: 'Cost',
                numeric: true,
                cell: (a) => <Money cents={a.acquiredCostCents} />,
              },
              {
                key: 'life',
                header: 'Life',
                numeric: true,
                cell: (a) => <span className="text-xs">{a.usefulLifeYears} yr</span>,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
