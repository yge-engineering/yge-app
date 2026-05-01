// /balance-sheet — point-in-time financial position from posted JEs.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  buildBalanceSheet,
  formatUSD,
  type Account,
  type BalanceSheet,
  type BalanceSheetSection,
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

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: { asOf?: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.asOf ?? '')
    ? (searchParams.asOf as string)
    : today;

  const [accounts, entries] = await Promise.all([fetchAccounts(), fetchEntries()]);
  const sheet = buildBalanceSheet({ accounts, entries, asOf });

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/income-statement"
          className="text-sm text-yge-blue-500 hover:underline"
        >
          P&amp;L &rarr;
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Balance Sheet</h1>
      <p className="mt-2 text-gray-700">
        Point-in-time financial position. Assets = Liabilities + Equity +
        current-period earnings. Built from POSTED journal entries through the
        as-of date.
      </p>

      <form
        action="/balance-sheet"
        className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
      >
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">As of</span>
          <input
            type="date"
            name="asOf"
            defaultValue={asOf}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Recalculate
        </button>
      </form>

      <div
        className={`mt-4 rounded border p-3 text-sm ${
          sheet.inBalance
            ? 'border-green-300 bg-green-50 text-green-900'
            : 'border-red-300 bg-red-50 text-red-900'
        }`}
      >
        <strong>{sheet.inBalance ? '✓ Books in balance' : '✗ OUT OF BALANCE'}</strong>{' '}
        Assets {formatUSD(sheet.assets.totalCents)} ={' '}
        Liabilities + Equity {formatUSD(sheet.totalLiabilitiesAndEquityCents)}
        {!sheet.inBalance && (
          <span> (Δ {formatUSD(sheet.imbalanceCents)})</span>
        )}
      </div>

      <article className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="border-b border-gray-300 pb-2 text-center">
          <h2 className="text-lg font-bold uppercase">
            Young General Engineering, Inc.
          </h2>
          <p className="text-sm">Balance Sheet</p>
          <p className="text-xs text-gray-600">As of {sheet.asOf}</p>
        </header>

        <SectionTable section={sheet.assets} />
        <SubtotalRow label="Total Assets" cents={sheet.assets.totalCents} highlight />

        <SectionTable section={sheet.liabilities} />
        <SubtotalRow label="Total Liabilities" cents={sheet.liabilities.totalCents} />

        <SectionTable section={sheet.equity} />
        <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1 text-sm italic">
          <span>Current period earnings</span>
          <span className="font-mono">
            {formatUSD(sheet.currentPeriodEarningsCents)}
          </span>
        </div>
        <SubtotalRow
          label="Total Equity"
          cents={sheet.equity.totalCents + sheet.currentPeriodEarningsCents}
        />

        <SubtotalRow
          label="Total Liabilities + Equity"
          cents={sheet.totalLiabilitiesAndEquityCents}
          highlight
        />
      </article>
    </main>
  );
}

function SectionTable({ section }: { section: BalanceSheetSection }) {
  if (section.lines.length === 0) {
    return (
      <section className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {section.label}
        </h3>
        <p className="mt-1 text-xs text-gray-400">No activity.</p>
      </section>
    );
  }
  return (
    <section className="mt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {section.label}
      </h3>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {section.lines.map((ln) => (
            <tr key={ln.accountNumber} className="border-b border-gray-100">
              <td className="w-20 px-2 py-1 font-mono text-xs text-gray-600">
                {ln.accountNumber}
              </td>
              <td className="px-2 py-1">{ln.accountName}</td>
              <td className="px-2 py-1 text-right font-mono">
                {formatUSD(ln.amountCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SubtotalRow({
  label,
  cents,
  highlight = false,
}: {
  label: string;
  cents: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`mt-1 flex items-center justify-between px-2 py-2 text-sm font-semibold ${
        highlight ? 'border-y-2 border-black' : 'border-b-2 border-gray-300'
      }`}
    >
      <span className="uppercase tracking-wide">{label}</span>
      <span className="font-mono">{formatUSD(cents)}</span>
    </div>
  );
}
