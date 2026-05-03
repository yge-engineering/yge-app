// /mileage — mileage log list view.
//
// Plain English: per-employee odometer / mileage entries. Personal-
// vehicle miles flow into IRS-rate reimbursement; company-vehicle
// miles back equipment depreciation + per-diem proof.

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
  computeMileageRollup,
  mileagePurposeLabel,
  reimbursementCents,
  type MileageEntry,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEntries(filter: {
  employeeId?: string;
  reimbursed?: string;
}): Promise<MileageEntry[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/mileage`);
    if (filter.employeeId) url.searchParams.set('employeeId', filter.employeeId);
    if (filter.reimbursed) url.searchParams.set('reimbursed', filter.reimbursed);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { entries: MileageEntry[] }).entries;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<MileageEntry[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/mileage`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { entries: MileageEntry[] }).entries;
  } catch {
    return [];
  }
}

export default async function MileagePage({
  searchParams,
}: {
  searchParams: { employeeId?: string; reimbursed?: string };
}) {
  const [entries, all] = await Promise.all([fetchEntries(searchParams), fetchAll()]);
  const rollup = computeMileageRollup(all);

  function buildHref(overrides: Partial<{ reimbursed?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.employeeId) params.set('employeeId', merged.employeeId);
    if (merged.reimbursed) params.set('reimbursed', merged.reimbursed);
    const q = params.toString();
    return q ? `/mileage?${q}` : '/mileage';
  }

  const csvHref = `${publicApiBaseUrl()}/api/mileage?format=csv${
    searchParams.employeeId ? '&employeeId=' + encodeURIComponent(searchParams.employeeId) : ''
  }`;
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('mileage.title')}
          subtitle={t('mileage.subtitle')}
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {t('mileage.csv')}
              </a>
              <LinkButton href="/mileage/new" variant="primary" size="md">
                {t('mileage.logMileage')}
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('mileage.tile.entries')} value={rollup.total} />
          <Tile label={t('mileage.tile.totalMiles')} value={rollup.totalBusinessMiles.toFixed(1)} />
          <Tile label={t('mileage.tile.personalMiles')} value={rollup.personalMiles.toFixed(1)} />
          <Tile
            label={t('mileage.tile.owed')}
            value={<Money cents={rollup.outstandingCents} />}
            tone={rollup.outstandingCents > 0 ? 'warn' : 'success'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('mileage.filter.reimbursed')}</span>
          <Link
            href={buildHref({ reimbursed: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.reimbursed ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('mileage.filter.all')}
          </Link>
          <Link
            href={buildHref({ reimbursed: 'false' })}
            className={`rounded px-2 py-1 text-xs ${searchParams.reimbursed === 'false' ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('mileage.filter.owed')}
          </Link>
          <Link
            href={buildHref({ reimbursed: 'true' })}
            className={`rounded px-2 py-1 text-xs ${searchParams.reimbursed === 'true' ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('mileage.filter.paid')}
          </Link>
        </section>

        {entries.length === 0 ? (
          <EmptyState
            title={t('mileage.empty.title')}
            body={t('mileage.empty.body')}
            actions={[{ href: '/mileage/new', label: t('mileage.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={entries}
            keyFn={(e) => e.id}
            columns={[
              {
                key: 'date',
                header: t('mileage.col.date'),
                cell: (e) => (
                  <Link href={`/mileage/${e.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {e.tripDate}
                  </Link>
                ),
              },
              { key: 'employee', header: t('mileage.col.employee'), cell: (e) => <span className="text-sm text-gray-900">{e.employeeName}</span> },
              {
                key: 'vehicle',
                header: t('mileage.col.vehicle'),
                cell: (e) => (
                  <span className="text-xs text-gray-700">
                    {e.vehicleDescription}
                    {e.isPersonalVehicle ? (
                      <span className="ml-1 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">{t('mileage.personal')}</span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: 'purpose',
                header: t('mileage.col.purpose'),
                cell: (e) => (
                  <span className="text-xs text-gray-700">
                    {mileagePurposeLabel(e.purpose)}
                    {e.jobId ? <div className="text-[10px] font-mono text-gray-500">{e.jobId}</div> : null}
                  </span>
                ),
              },
              { key: 'miles', header: t('mileage.col.miles'), numeric: true, cell: (e) => <span className="font-mono text-sm">{e.businessMiles.toFixed(1)}</span> },
              {
                key: 'reimburse',
                header: t('mileage.col.reimburse'),
                numeric: true,
                cell: (e) => {
                  const reimb = reimbursementCents(e);
                  return reimb > 0 ? <Money cents={reimb} /> : <span className="font-mono text-gray-400">—</span>;
                },
              },
              {
                key: 'status',
                header: t('mileage.col.status'),
                cell: (e) => {
                  const reimb = reimbursementCents(e);
                  if (e.reimbursed) return <StatusPill label={t('mileage.status.paid')} tone="success" />;
                  if (reimb > 0) return <StatusPill label={t('mileage.status.owed')} tone="warn" />;
                  return <span className="text-xs text-gray-400">—</span>;
                },
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
