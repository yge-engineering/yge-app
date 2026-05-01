// /coa/new — add a new account.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { AccountEditor } from '../../../components/account-editor';

export default function NewAccountPage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/coa" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Chart of Accounts
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New account</h1>
      <p className="mt-2 text-gray-700">
        Add a single account. The leading digit auto-suggests the type;
        override on the editor if needed.
      </p>
      <div className="mt-6">
        <AccountEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
