// /trial-balance — debit/credit by account from posted journal entries.
//
// Plain English: sum of debits and credits per account from every
// POSTED journal entry. The books are square when total debits equal
// total credits to the cent — anything else is a bookkeeping error
// that needs hunting down.

import {
  Alert,
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  accountTypeLabel,
  computeAccountBalances,
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
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title={t('tb.title')}
          subtitle={t('tb.subtitle')}
          back={{ href: '/journal-entries', label: t('tb.back') }}
        />

        <Alert
          tone={balanced ? 'success' : 'danger'}
          title={balanced ? t('tb.balanced') : t('tb.outOfBalance')}
          className="mb-4"
        >
          {/* totalsLine pre-renders Money in the placeholders, so we keep it as a JSX fragment. */}
          {(() => {
            const tpl = t('tb.totalsLine', { debit: '__DEBIT__', credit: '__CREDIT__' });
            const [pre, mid, post] = tpl.split(/__DEBIT__|__CREDIT__/);
            return (
              <>
                {pre}<Money cents={totalDebit} />{mid}<Money cents={totalCredit} />{post}
              </>
            );
          })()}
        </Alert>

        {balances.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            {t('tb.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('tb.col.number')}</th>
                  <th className="px-4 py-2">{t('tb.col.name')}</th>
                  <th className="px-4 py-2">{t('tb.col.type')}</th>
                  <th className="px-4 py-2 text-right">{t('tb.col.debit')}</th>
                  <th className="px-4 py-2 text-right">{t('tb.col.credit')}</th>
                  <th className="px-4 py-2 text-right">{t('tb.col.balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {balances.map((b) => {
                  const acc = accountByNum.get(b.accountNumber);
                  return (
                    <tr key={b.accountNumber}>
                      <td className="px-4 py-3 font-mono text-sm">{b.accountNumber}</td>
                      <td className="px-4 py-3 text-sm">
                        {acc?.name ?? <span className="text-red-700">{t('tb.unknownAccount')}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {acc ? accountTypeLabel(acc.type) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {b.debitCents > 0 ? <Money cents={b.debitCents} /> : <span className="font-mono text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {b.creditCents > 0 ? <Money cents={b.creditCents} /> : <span className="font-mono text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Money
                          cents={b.balanceCents}
                          className={`font-semibold ${b.balanceCents < 0 ? 'text-red-700' : ''}`}
                        />
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wide">{t('tb.totals')}</td>
                  <td className="px-4 py-3 text-right"><Money cents={totalDebit} /></td>
                  <td className="px-4 py-3 text-right"><Money cents={totalCredit} /></td>
                  <td className="px-4 py-3 text-right"><Money cents={totalDebit - totalCredit} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
