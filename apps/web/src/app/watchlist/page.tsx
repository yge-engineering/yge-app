// /watchlist — certification + COI expiry rollup.
//
// Plain English: every employee certification + every subcontractor
// COI, ranked by expiration. Don't put a guy with a lapsed CDL on a
// road crew, and don't schedule a sub whose COI just expired.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  bucketLabel,
  computeWatchlistRollup,
  rowsFromEmployees,
  rowsFromVendors,
  sortWatchlistRows,
  type Employee,
  type Vendor,
  type WatchlistBucket,
} from '@yge/shared';

const BUCKETS: WatchlistBucket[] = ['EXPIRED', 'WITHIN_30', 'WITHIN_60', 'WITHIN_90', 'BEYOND'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { employees: Employee[] }).employees;
  } catch {
    return [];
  }
}
async function fetchVendors(): Promise<Vendor[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/vendors?kind=SUBCONTRACTOR`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { vendors: Vendor[] }).vendors;
  } catch {
    return [];
  }
}

function bucketTone(b: WatchlistBucket): 'danger' | 'warn' | 'info' | 'muted' | 'neutral' {
  switch (b) {
    case 'EXPIRED':
      return 'danger';
    case 'WITHIN_30':
      return 'warn';
    case 'WITHIN_60':
      return 'info';
    case 'WITHIN_90':
    case 'BEYOND':
      return 'muted';
    default:
      return 'neutral';
  }
}

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: { kind?: string; bucket?: string };
}) {
  const [employees, vendors] = await Promise.all([fetchEmployees(), fetchVendors()]);
  const allRows = sortWatchlistRows([
    ...rowsFromEmployees(employees),
    ...rowsFromVendors(vendors),
  ]);

  let visible = allRows;
  if (searchParams.kind === 'EMPLOYEE_CERT' || searchParams.kind === 'SUB_COI') {
    visible = visible.filter((r) => r.kind === searchParams.kind);
  }
  if (
    searchParams.bucket &&
    BUCKETS.includes(searchParams.bucket as WatchlistBucket)
  ) {
    visible = visible.filter((r) => r.bucket === searchParams.bucket);
  }

  const rollup = computeWatchlistRollup(allRows);

  function buildHref(overrides: Partial<{ kind?: string; bucket?: string }>) {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.kind) params.set('kind', merged.kind);
    if (merged.bucket) params.set('bucket', merged.bucket);
    const q = params.toString();
    return q ? `/watchlist?${q}` : '/watchlist';
  }
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('watchlist.title')}
          subtitle={t('watchlist.subtitle')}
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-5">
          <Tile label={t('watchlist.tile.expired')} value={rollup.expired} tone={rollup.expired > 0 ? 'danger' : 'success'} />
          <Tile label={t('watchlist.tile.within30')} value={rollup.within30} tone={rollup.within30 > 0 ? 'warn' : 'success'} />
          <Tile label={t('watchlist.tile.within60')} value={rollup.within60} />
          <Tile label={t('watchlist.tile.within90')} value={rollup.within90} />
          <Tile
            label={t('watchlist.tile.peopleNeedAction')}
            value={rollup.immediateActionSubjects}
            tone={rollup.immediateActionSubjects > 0 ? 'warn' : 'success'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('watchlist.filter.kind')}</span>
          <Chip href={buildHref({ kind: undefined })} active={!searchParams.kind} label={t('watchlist.filter.all')} />
          <Chip href={buildHref({ kind: 'EMPLOYEE_CERT' })} active={searchParams.kind === 'EMPLOYEE_CERT'} label={t('watchlist.filter.employeeCerts')} />
          <Chip href={buildHref({ kind: 'SUB_COI' })} active={searchParams.kind === 'SUB_COI'} label={t('watchlist.filter.subCois')} />
          <span className="ml-4 text-xs uppercase tracking-wide text-gray-500">{t('watchlist.filter.bucket')}</span>
          <Chip href={buildHref({ bucket: undefined })} active={!searchParams.bucket} label={t('watchlist.filter.all')} />
          {BUCKETS.map((b) => (
            <Chip key={b} href={buildHref({ bucket: b })} active={searchParams.bucket === b} label={bucketLabel(b)} />
          ))}
        </section>

        {visible.length === 0 ? (
          <EmptyState
            title={t('watchlist.empty.title')}
            body={t('watchlist.empty.body')}
          />
        ) : (
          <DataTable
            rows={visible.map((r) => ({ ...r, id: r.rowId }))}
            keyFn={(r) => r.rowId}
            columns={[
              {
                key: 'subject',
                header: t('watchlist.col.subject'),
                cell: (r) => (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{r.subjectName}</div>
                    <div className="text-[10px] text-gray-500">{r.kind === 'EMPLOYEE_CERT' ? t('watchlist.subjectKind.employee') : t('watchlist.subjectKind.subcontractor')}</div>
                  </div>
                ),
              },
              {
                key: 'item',
                header: t('watchlist.col.item'),
                cell: (r) => (
                  <div className="text-xs text-gray-700">
                    {r.itemLabel}
                    {r.issuer ? <div className="text-[10px] text-gray-500">{r.issuer}</div> : null}
                  </div>
                ),
              },
              {
                key: 'expires',
                header: t('watchlist.col.expires'),
                cell: (r) => <span className="font-mono text-xs text-gray-700">{r.expiresOn}</span>,
              },
              {
                key: 'days',
                header: t('watchlist.col.days'),
                numeric: true,
                cell: (r) => (
                  <span
                    className={`font-mono text-sm ${
                      r.daysUntilExpiry < 0
                        ? 'font-bold text-red-700'
                        : r.daysUntilExpiry <= 30
                          ? 'font-semibold text-amber-800'
                          : 'text-gray-700'
                    }`}
                  >
                    {r.daysUntilExpiry < 0 ? `${r.daysUntilExpiry}` : `+${r.daysUntilExpiry}`}
                  </span>
                ),
              },
              {
                key: 'status',
                header: t('watchlist.col.status'),
                cell: (r) => <StatusPill label={bucketLabel(r.bucket)} tone={bucketTone(r.bucket)} />,
              },
              {
                key: 'open',
                header: '',
                cell: (r) => (
                  <Link href={r.href} className="text-xs text-blue-700 hover:underline">
                    {t('watchlist.open')}
                  </Link>
                ),
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}

function Chip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded px-2 py-1 text-xs ${
        active
          ? 'bg-blue-700 text-white'
          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
  );
}

