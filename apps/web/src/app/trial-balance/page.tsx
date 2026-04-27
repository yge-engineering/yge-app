// /trial-balance — debit/credit by account from posted journal entries.

import Link from 'next/link';
import {
  accountTypeLabel,
  computeAccountBalances,
  formatUSD,
  type Account,
  type JournalEntry,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch(`${apiBaseUrl()}/api/coa`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { accounts: Account[] }).accounts;
}
async function fetchEntries(): Promise<JournalEntry[]> {
  const res = await fetch(`${apiBaseUrl()}/api/journal-entries`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { entries: JournalEntry[] }).entries;
}

export default async function TrialBalancePage() {
  const [accounts, entries] = await Promise.all([fetchAccounts(), fetchEntries()]);
  const accountByNum = new Map(accounts.map((a) => [a.number, a]));
  const balances = computeAccountBalances(entries);

  let totalDebit = 0;
  let totalCredit = 0;
  for (const b of balances) {
    totalDebit += b.debitCents;
    totalCredit += b.creditCents;
  }
  const balanced = totalDebit === totalCredit;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <Link href="/journal-entries" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Journal Entries
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Trial Balance</h1>
      <p className="mt-2 text-gray-700">
        Sum of debits and credits per account from every POSTED journal entry.
        The books are square when total debits equal total credits to the
        cent.
      </p>

      <div
        className={`mt-4 rounded border p-3 text-sm ${
          balanced
            ? 'border-green-300 bg-green-50 text-green-900'
            : 'border-red-300 bg-red-50 text-red-900'
        }`}
      >
        <strong>{balanced ? '✓ Books in balance' : '✗ OUT OF BALANCE'}</strong>{' '}
        Total debits {formatUSD(totalDebit)} · total credits {formatUSD(totalCredit)}
      </div>

      {balances.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No posted entries yet. Trial balance fills in once journal entries
          start posting.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Debit</th>
                <th className="px-4 py-2 text-right">Credit</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {balances.map((b) => {
                const acc = accountByNum.get(b.accountNumber);
                return (
                  <tr key={b.accountNumber}>
                    <td className="px-4 py-3 font-mono text-sm">
                      {b.accountNumber}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {acc?.name ?? <span className="text-red-700">Unknown account</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {acc ? accountTypeLabel(acc.type) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {b.debitCents > 0 ? formatUSD(b.debitCents) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {b.creditCents > 0 ? formatUSD(b.creditCents) : '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold ${
                        b.balanceCents < 0 ? 'text-red-700' : 'text-gray-900'
                      }`}
                    >
                      {formatUSD(b.balanceCents)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wide">
                  Totals
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatUSD(totalDebit)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatUSD(totalCredit)}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatUSD(totalDebit - totalCredit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
