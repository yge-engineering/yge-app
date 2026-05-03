// /coa — chart of accounts list view.
//
// Plain English: GL backbone for AP coding, AR posting, and Phase 2
// trial balance / P&L. Standard 5-digit construction numbering: 1xxxx
// assets, 2xxxx liabilities, 3xxxx equity, 4xxxx revenue, 5xxxx job
// cost (COGS), 6xxxx overhead, 7xxxx other.

import Link from 'next/link';

import {
  Alert,
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  accountTypeLabel,
  computeCoaRollup,
  type Account,
  type AccountType,
} from '@yge/shared';
import { CoaSeedButton } from '../../components/coa-seed-button';

const TYPES: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'COGS',
  'EXPENSE',
  'OTHER_INCOME',
  'OTHER_EXPENSE',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchAccounts(filter: { type?: string }): Promise<Account[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/coa`);
    if (filter.type) url.searchParams.set('type', filter.type);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { accounts: Account[] }).accounts;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<Account[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/coa`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { accounts: Account[] }).accounts;
  } catch {
    return [];
  }
}

export default async function CoaPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const [accounts, all] = await Promise.all([fetchAccounts(searchParams), fetchAll()]);
  const rollup = computeCoaRollup(all);
  const empty = all.length === 0;

  function buildHref(overrides: Partial<{ type?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.type) params.set('type', merged.type);
    const q = params.toString();
    return q ? `/coa?${q}` : '/coa';
  }
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('coa.title')}
          subtitle={t('coa.subtitle')}
          actions={
            <span className="flex gap-2">
              {empty ? <CoaSeedButton apiBaseUrl={publicApiBaseUrl()} /> : null}
              <LinkButton href="/coa/new" variant="primary" size="md">
                {t('coa.addAccount')}
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('coa.tile.total')} value={rollup.total} />
          <Tile label={t('coa.tile.active')} value={rollup.active} />
          <Tile label={t('coa.tile.inactive')} value={rollup.inactive} />
          <Tile label={t('coa.tile.types')} value={rollup.byType.length} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('coa.filter.type')}</span>
          <Link
            href={buildHref({ type: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.type ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('coa.filter.all')}
          </Link>
          {TYPES.map((tp) => (
            <Link
              key={tp}
              href={buildHref({ type: tp })}
              className={`rounded px-2 py-1 text-xs ${searchParams.type === tp ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {accountTypeLabel(tp)}
            </Link>
          ))}
        </section>

        {empty ? (
          <Alert tone="warn" title={t('coa.empty.title')}>
            {t('coa.empty.body')}
          </Alert>
        ) : accounts.length === 0 ? (
          <EmptyState title={t('coa.empty.filter.title')} body={t('coa.empty.filter.body')} />
        ) : (
          <DataTable
            rows={accounts}
            keyFn={(a) => a.id}
            columns={[
              {
                key: 'number',
                header: t('coa.col.number'),
                cell: (a) => (
                  <Link href={`/coa/${a.id}`} className={`font-mono text-sm font-medium ${a.active ? 'text-blue-700 hover:underline' : 'text-gray-400'}`}>
                    {a.number}
                  </Link>
                ),
              },
              {
                key: 'name',
                header: t('coa.col.name'),
                cell: (a) => (
                  <span className={`text-sm ${a.active ? 'text-gray-900' : 'text-gray-400'}`}>
                    {a.parentNumber ? <span className="text-gray-400">↳ </span> : null}
                    {a.name}
                  </span>
                ),
              },
              { key: 'type', header: t('coa.col.type'), cell: (a) => <span className="text-xs text-gray-700">{accountTypeLabel(a.type)}</span> },
              {
                key: 'parent',
                header: t('coa.col.parent'),
                cell: (a) => <span className="font-mono text-xs text-gray-700">{a.parentNumber ?? '—'}</span>,
              },
              {
                key: 'status',
                header: t('coa.col.status'),
                cell: (a) =>
                  a.active ? <StatusPill label={t('coa.status.active')} tone="success" /> : <StatusPill label={t('coa.status.inactive')} tone="muted" />,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
