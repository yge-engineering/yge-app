// /coa/[id] — account detail / edit.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import { accountTypeLabel, type Account } from '@yge/shared';
import { AccountEditor } from '../../../components/account-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAccount(id: string): Promise<Account | null> {
  const res = await fetch(`${apiBaseUrl()}/api/coa/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { account: Account }).account;
}

export default async function AccountDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const account = await fetchAccount(params.id);
  if (!account) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/coa" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Chart of Accounts
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {account.number} · {account.name}
      </h1>
      <p className="mt-1 text-sm text-gray-600">{accountTypeLabel(account.type)}</p>
      <p className="mt-1 text-xs text-gray-500">ID: {account.id}</p>
      <div className="mt-6">
        <AccountEditor mode="edit" account={account} />
      </div>

      <AuditBinderPanel entityType="Account" entityId={account.id} />
    </main>
  );
}
