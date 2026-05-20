// /journal-entries/by-account — general-ledger detail for one account.
//
// The drill-down behind a trial-balance row or an income-statement line:
// opening balance, every posted journal-entry line that hit the account in
// the period, a running balance, and the ending balance. Each row links to
// the journal entry it came from.

import Link from 'next/link';
import { AppShell, Money, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { PrintButton } from '../../../components/print-button';
import { StatementCsvButton } from '../../../components/statement-csv-button';
import {
  accountTypeLabel,
  buildAccountLedger,
  journalEntrySourceLabel,
  type Account,
  type JournalEntry,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAccounts(): Promise<Account[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/coa`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { accounts: Account[] }).accounts;
  } catch { return []; }
}
async function fetchEntries(): Promise<JournalEntry[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/journal-entries`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { entries: JournalEntry[] }).entries;
  } catch { return []; }
}

export default async function ByAccountPage({
  searchParams,
}: {
  searchParams: { account?: string; start?: string; end?: string };
}) {
  requirePermission('financials:view');
  const account = /^\d{4,6}$/.test(searchParams.account ?? '') ? (searchParams.account as string) : '';
  const periodStart = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.start ?? '') ? (searchParams.start as string) : undefined;
  const periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.end ?? '') ? (searchParams.end as string) : undefined;

  const [accounts, entries] = await Promise.all([fetchAccounts(), fetchEntries()]);
  const acc = accounts.find((a) => a.number === account);
  const ledger = account
    ? buildAccountLedger(entries, account, {
        ...(periodStart ? { periodStart } : {}),
        ...(periodEnd ? { periodEnd } : {}),
      })
    : null;

  const ledgerHeaders = ['Date', 'Entry', 'Memo', 'Source', 'Debit', 'Credit', 'Balance'];
  const dl = (c: number) => (c / 100).toFixed(2);
  const ledgerCsvRows: Array<Array<string | number>> = ledger
    ? ledger.lines.map((l) => [
        l.entryDate,
        l.entryId,
        l.lineMemo ? `${l.memo} · ${l.lineMemo}` : l.memo,
        l.source,
        dl(l.debitCents),
        dl(l.creditCents),
        dl(l.runningBalanceCents),
      ])
    : [];

  const sortedAccounts = [...accounts].sort((a, b) => a.number.localeCompare(b.number));

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <div className="mb-3">
          <Link href="/trial-balance" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Trial balance
          </Link>
        </div>
        <PageHeader
          title="Account ledger"
          subtitle="The transactions behind an account balance. Pick an account and (optionally) a period to see the posted detail."
        />

        <form action="/journal-entries/by-account" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3 print:hidden">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Account</span>
            <select name="account" defaultValue={account} className="rounded border border-gray-300 px-2 py-1 text-sm">
              <option value="">Select an account…</option>
              {sortedAccounts.map((a) => (
                <option key={a.number} value={a.number}>
                  {a.number} — {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">From</span>
            <input type="date" name="start" defaultValue={periodStart ?? ''} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">To</span>
            <input type="date" name="end" defaultValue={periodEnd ?? ''} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <button type="submit" className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700">
            Show ledger
          </button>
        </form>

        <div className="mb-4 flex justify-end gap-2 print:hidden">
          {ledger ? <StatementCsvButton filename={`account-${account}.csv`} headers={ledgerHeaders} rows={ledgerCsvRows} /> : null}
          <PrintButton />
        </div>

        {!ledger ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            Pick an account above to see its ledger detail.
          </div>
        ) : (
          <>
            <div className="mb-3 rounded-md border border-gray-200 bg-white p-4">
              <h2 className="text-lg font-bold">
                {ledger.accountNumber} — {acc?.name ?? <span className="text-red-700">Unknown account</span>}
              </h2>
              {acc && <p className="text-xs uppercase tracking-wide text-gray-500">{accountTypeLabel(acc.type)}</p>}
            </div>

            <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Entry</th>
                    <th className="px-3 py-2">Memo</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-gray-50 text-xs italic text-gray-600">
                    <td className="px-3 py-2" colSpan={6}>Opening balance{periodStart ? ` (before ${periodStart})` : ''}</td>
                    <td className="px-3 py-2 text-right font-mono"><Money cents={ledger.openingBalanceCents} /></td>
                  </tr>
                  {ledger.lines.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-sm text-gray-500" colSpan={7}>No posted activity in this period.</td>
                    </tr>
                  ) : (
                    ledger.lines.map((ln, i) => (
                      <tr key={`${ln.entryId}-${i}`}>
                        <td className="px-3 py-2 font-mono text-xs">{ln.entryDate}</td>
                        <td className="px-3 py-2">
                          <Link href={`/journal-entries/${ln.entryId}`} className="font-mono text-xs text-yge-blue-600 hover:underline">
                            {ln.entryId}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {ln.memo}
                          {ln.lineMemo ? <span className="ml-1 text-xs text-gray-500">· {ln.lineMemo}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{journalEntrySourceLabel(ln.source as Parameters<typeof journalEntrySourceLabel>[0])}</td>
                        <td className="px-3 py-2 text-right font-mono">{ln.debitCents > 0 ? <Money cents={ln.debitCents} /> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-right font-mono">{ln.creditCents > 0 ? <Money cents={ln.creditCents} /> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-right font-mono"><Money cents={ln.runningBalanceCents} /></td>
                      </tr>
                    ))
                  )}
                  <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                    <td className="px-3 py-2 uppercase tracking-wide" colSpan={4}>Totals / ending balance</td>
                    <td className="px-3 py-2 text-right font-mono"><Money cents={ledger.totalDebitCents} /></td>
                    <td className="px-3 py-2 text-right font-mono"><Money cents={ledger.totalCreditCents} /></td>
                    <td className="px-3 py-2 text-right font-mono"><Money cents={ledger.endingBalanceCents} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
