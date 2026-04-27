// /coa — chart of accounts list view.

import Link from 'next/link';
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
  const url = new URL(`${apiBaseUrl()}/api/coa`);
  if (filter.type) url.searchParams.set('type', filter.type);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { accounts: Account[] }).accounts;
}
async function fetchAll(): Promise<Account[]> {
  const res = await fetch(`${apiBaseUrl()}/api/coa`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { accounts: Account[] }).accounts;
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
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <div className="flex items-center gap-2">
          {empty && <CoaSeedButton apiBaseUrl={publicApiBaseUrl()} />}
          <Link
            href="/coa/new"
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + Add account
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Chart of Accounts</h1>
      <p className="mt-2 text-gray-700">
        GL backbone for AP coding, AR posting, and Phase 2 trial balance / P&amp;L.
        Standard 5-digit construction numbering: 1xxxx assets, 2xxxx liabilities,
        3xxxx equity, 4xxxx revenue, 5xxxx job cost (COGS), 6xxxx overhead,
        7xxxx other.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total accounts" value={rollup.total} />
        <Stat label="Active" value={rollup.active} />
        <Stat label="Inactive" value={rollup.inactive} />
        <Stat
          label="Account types"
          value={rollup.byType.length}
        />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Type:</span>
        <Link
          href={buildHref({ type: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.type ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {TYPES.map((t) => (
          <Link
            key={t}
            href={buildHref({ type: t })}
            className={`rounded px-2 py-1 text-xs ${searchParams.type === t ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {accountTypeLabel(t)}
          </Link>
        ))}
      </section>

      {empty ? (
        <div className="mt-6 rounded border border-yellow-300 bg-yellow-50 p-6 text-sm text-yellow-900">
          <strong>No accounts yet.</strong> Click <em>Apply default seed</em>{' '}
          above to drop in the starter CA construction COA (~50 accounts) — you
          can prune it after.
        </div>
      ) : accounts.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          Nothing in this filter.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Parent</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((a) => (
                <tr key={a.id} className={a.active ? '' : 'text-gray-400'}>
                  <td className="px-4 py-3 font-mono text-sm">{a.number}</td>
                  <td className="px-4 py-3 text-sm">
                    {a.parentNumber && <span className="text-gray-400">↳ </span>}
                    {a.name}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {accountTypeLabel(a.type)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {a.parentNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {a.active ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-700">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link href={`/coa/${a.id}`} className="text-yge-blue-500 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
