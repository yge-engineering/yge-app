// /coa — chart of accounts list view.
//
// Plain English: GL backbone for AP coding, AR posting, and Phase 2
// trial balance / P&L. Standard 5-digit construction numbering: 1xxxx
// assets, 2xxxx liabilities, 3xxxx equity, 4xxxx revenue, 5xxxx job
// cost (COGS), 6xxxx overhead, 7xxxx other.

import Link from 'next/link';

import {
  AppShell,
  Card,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
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

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Chart of accounts"
          subtitle="GL backbone for AP coding, AR posting, and Phase 2 trial balance / P&L. Standard 5-digit construction numbering."
          actions={
            <span className="flex gap-2">
              {empty ? <CoaSeedButton apiBaseUrl={publicApiBaseUrl()} /> : null}
              <LinkButton href="/coa/new" variant="primary" size="md">
                + Add account
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total accounts" value={rollup.total} />
          <Tile label="Active" value={rollup.active} />
          <Tile label="Inactive" value={rollup.inactive} />
          <Tile label="Account types" value={rollup.byType.length} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Type:</span>
          <Link
            href={buildHref({ type: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.type ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {TYPES.map((t) => (
            <Link
              key={t}
              href={buildHref({ type: t })}
              className={`rounded px-2 py-1 text-xs ${searchParams.type === t ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {accountTypeLabel(t)}
            </Link>
          ))}
        </section>

        {empty ? (
          <Card className="border-amber-300 bg-amber-50">
            <p className="text-sm text-amber-900">
              <strong>No accounts yet.</strong> Click <em>Apply default seed</em> above
              to drop in the starter CA construction COA (~50 accounts) — you can
              prune it after.
            </p>
          </Card>
        ) : accounts.length === 0 ? (
          <EmptyState title="Nothing in this filter" body="Try widening the type filter, or add a new account." />
        ) : (
          <DataTable
            rows={accounts}
            keyFn={(a) => a.id}
            columns={[
              {
                key: 'number',
                header: '#',
                cell: (a) => (
                  <Link href={`/coa/${a.id}`} className={`font-mono text-sm font-medium ${a.active ? 'text-blue-700 hover:underline' : 'text-gray-400'}`}>
                    {a.number}
                  </Link>
                ),
              },
              {
                key: 'name',
                header: 'Name',
                cell: (a) => (
                  <span className={`text-sm ${a.active ? 'text-gray-900' : 'text-gray-400'}`}>
                    {a.parentNumber ? <span className="text-gray-400">↳ </span> : null}
                    {a.name}
                  </span>
                ),
              },
              { key: 'type', header: 'Type', cell: (a) => <span className="text-xs text-gray-700">{accountTypeLabel(a.type)}</span> },
              {
                key: 'parent',
                header: 'Parent',
                cell: (a) => <span className="font-mono text-xs text-gray-700">{a.parentNumber ?? '—'}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (a) =>
                  a.active ? <StatusPill label="Active" tone="success" /> : <StatusPill label="Inactive" tone="muted" />,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
