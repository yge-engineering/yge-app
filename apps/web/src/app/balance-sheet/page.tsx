// /balance-sheet — point-in-time financial position from posted JEs.
//
// Plain English: Assets = Liabilities + Equity + current-period
// earnings. Built from POSTED journal entries through the as-of date.
// The in-balance check at the top is the bookkeeper's first sanity
// step before printing the statement.

import {
  Alert,
  AppShell,
  LinkButton,
  Money,
  PageHeader,
} from '../../components';
import {
  buildBalanceSheet,
  type Account,
  type BalanceSheetSection,
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
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Balance sheet"
          subtitle="Point-in-time financial position. Assets = Liabilities + Equity + current-period earnings. Built from POSTED journal entries through the as-of date."
          actions={
            <LinkButton href="/income-statement" variant="secondary" size="md">
              P&L →
            </LinkButton>
          }
        />

        <form action="/balance-sheet" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">As of</span>
            <input
              type="date"
              name="asOf"
              defaultValue={asOf}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
            Recalculate
          </button>
        </form>

        <Alert
          tone={sheet.inBalance ? 'success' : 'danger'}
          title={sheet.inBalance ? '✓ Books in balance' : '✗ OUT OF BALANCE'}
          className="mb-4"
        >
          Assets <Money cents={sheet.assets.totalCents} /> = Liabilities + Equity{' '}
          <Money cents={sheet.totalLiabilitiesAndEquityCents} />
          {!sheet.inBalance ? <> (Δ <Money cents={sheet.imbalanceCents} />)</> : null}
        </Alert>

        <article className="rounded-md border border-gray-200 bg-white p-6">
          <header className="border-b border-gray-300 pb-2 text-center">
            <h2 className="text-lg font-bold uppercase">Young General Engineering, Inc.</h2>
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
            <Money cents={sheet.currentPeriodEarningsCents} />
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
    </AppShell>
  );
}

function SectionTable({ section }: { section: BalanceSheetSection }) {
  if (section.lines.length === 0) {
    return (
      <section className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{section.label}</h3>
        <p className="mt-1 text-xs text-gray-400">No activity.</p>
      </section>
    );
  }
  return (
    <section className="mt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{section.label}</h3>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {section.lines.map((ln) => (
            <tr key={ln.accountNumber} className="border-b border-gray-100">
              <td className="w-20 px-2 py-1 font-mono text-xs text-gray-600">{ln.accountNumber}</td>
              <td className="px-2 py-1">{ln.accountName}</td>
              <td className="px-2 py-1 text-right">
                <Money cents={ln.amountCents} />
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
      <Money cents={cents} />
    </div>
  );
}
