// /bank-recs/new — start a new bank reconciliation.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { BankRecEditor } from '../../../components/bank-rec-editor';

export default function NewBankRecPage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/bank-recs" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Bank Reconciliations
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New bank rec</h1>
      <p className="mt-2 text-gray-700">
        Type in the statement balance and the GL balance for the same date.
        Add outstanding checks, deposits in transit, fees, and interest until
        the rec squares.
      </p>
      <div className="mt-6">
        <BankRecEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
