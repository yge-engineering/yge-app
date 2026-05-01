// /dir-rates — DIR prevailing wage rate library.
//
// Plain English: California Department of Industrial Relations general
// prevailing wage determinations. Drives certified payroll and labor
// billing rates on public-works contracts. Rate expiration matters —
// rows past their expiry are dimmed.

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
import {
  classificationLabel,
  computeDirRateRollup,
  totalFringeCents,
  totalPrevailingWageCents,
  type DirRate,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchRates(filter: { classification?: string; county?: string }): Promise<DirRate[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/dir-rates`);
    if (filter.classification) url.searchParams.set('classification', filter.classification);
    if (filter.county) url.searchParams.set('county', filter.county);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { rates: DirRate[] }).rates;
  } catch {
    return [];
  }
}

export default async function DirRatesPage({
  searchParams,
}: {
  searchParams: { classification?: string; county?: string };
}) {
  const rates = await fetchRates(searchParams);
  const rollup = computeDirRateRollup(rates);
  const today = new Date().toISOString().slice(0, 10);

  const csvHref = `${publicApiBaseUrl()}/api/dir-rates?format=csv${
    searchParams.classification ? '&classification=' + encodeURIComponent(searchParams.classification) : ''
  }${searchParams.county ? '&county=' + encodeURIComponent(searchParams.county) : ''}`;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="DIR prevailing wage"
          subtitle="California Department of Industrial Relations general prevailing wage determinations. Drives certified payroll and labor billing rates on public-works contracts."
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Download CSV
              </a>
              <LinkButton href="/dir-rates/new" variant="primary" size="md">
                + New rate
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Determinations" value={rollup.total} />
          <Tile label="Classifications" value={rollup.classifications} />
          <Tile label="Counties" value={rollup.counties} />
          <Tile
            label="Active today"
            value={rollup.activeToday}
            tone={rollup.activeToday > 0 ? 'success' : 'warn'}
          />
        </section>

        {rates.length === 0 ? (
          <EmptyState
            title="No DIR rates loaded yet"
            body={(
              <>
                Add a determination from{' '}
                <a
                  href="https://www.dir.ca.gov/oprl/PWD/index.htm"
                  className="text-blue-700 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  DIR's website
                </a>
                . The bulk import sync that pulls from DIR directly is on the roadmap.
              </>
            )}
            actions={[{ href: '/dir-rates/new', label: 'New rate', primary: true }]}
          />
        ) : (
          <DataTable
            rows={rates}
            keyFn={(r) => r.id}
            columns={[
              {
                key: 'classification',
                header: 'Classification',
                cell: (r) => (
                  <Link href={`/dir-rates/${r.id}`} className="text-xs font-medium text-blue-700 hover:underline">
                    {classificationLabel(r.classification)}
                  </Link>
                ),
              },
              { key: 'county', header: 'County', cell: (r) => <span className="text-xs">{r.county}</span> },
              { key: 'effective', header: 'Effective', cell: (r) => <span className="font-mono text-xs">{r.effectiveDate}</span> },
              {
                key: 'expires',
                header: 'Expires',
                cell: (r) => {
                  const isActive = r.effectiveDate <= today && (!r.expiresOn || r.expiresOn >= today);
                  return (
                    <span className={`font-mono text-xs ${isActive ? '' : 'text-gray-400'}`}>
                      {r.expiresOn ?? 'current'}
                    </span>
                  );
                },
              },
              { key: 'basic', header: 'Basic', numeric: true, cell: (r) => <Money cents={r.basicHourlyCents} /> },
              { key: 'fringe', header: 'Fringe', numeric: true, cell: (r) => <Money cents={totalFringeCents(r)} /> },
              {
                key: 'total',
                header: 'Total',
                numeric: true,
                cell: (r) => <Money cents={totalPrevailingWageCents(r)} className="font-semibold" />,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
