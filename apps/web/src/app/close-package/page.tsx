// /close-package — month-end close package.
//
// Stacks Trial balance, Income statement, Balance sheet, and Cash
// flow on a single print-ready page. Bookkeeper picks the period,
// hits Print → browser save-to-PDF gives a single bundled PDF.

import { AppShell, Money, PageHeader } from '../../components';
import { getTranslator } from '../../lib/locale';
import { requirePermission } from '../../lib/permissions';
import {
  buildBalanceSheet,
  buildCashFlow,
  buildIncomeStatement,
  computeAccountBalances,
  type Account,
  type ApPayment,
  type ArPayment,
  type Expense,
  type JournalEntry,
} from '@yge/shared';
import { PrintButton } from '../../components/print-button';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

export default async function ClosePackagePage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  requirePermission('financials:view');
  const def = defaultPeriod();
  const periodStart = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.start ?? '')
    ? (searchParams.start as string)
    : def.start;
  const periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.end ?? '')
    ? (searchParams.end as string)
    : def.end;

  const [accounts, entries, arPayments, apPayments, expenses] =
    await Promise.all([
      fetchJson<Account>('/api/coa', 'accounts'),
      fetchJson<JournalEntry>('/api/journal-entries', 'entries'),
      fetchJson<ArPayment>('/api/ar-payments', 'payments'),
      fetchJson<ApPayment>('/api/ap-payments', 'payments'),
      fetchJson<Expense>('/api/expenses', 'expenses'),
    ]);

  const accountByNum = new Map(accounts.map((a) => [a.number, a]));
  const balances = computeAccountBalances(entries);
  const incomeStatement = buildIncomeStatement({
    accounts,
    entries,
    periodStart,
    periodEnd,
  });
  const balanceSheet = buildBalanceSheet({
    accounts,
    entries,
    asOf: periodEnd,
  });
  const cashFlow = buildCashFlow({
    arPayments,
    apPayments,
    expenses,
    periodStart,
    periodEnd,
  });

  let totalDebit = 0;
  let totalCredit = 0;
  for (const b of balances) {
    totalDebit += b.debitCents;
    totalCredit += b.creditCents;
  }

  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl print:max-w-none print:p-0">
        <div className="print:hidden">
          <PageHeader
            title="Close package"
            subtitle="Trial balance, income statement, balance sheet, and cash flow stacked on one print-ready page. Period is set with the form below."
            actions={<PrintButton />}
          />
          <form
            action="/close-package"
            className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3"
          >
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">
                Period start
              </span>
              <input
                type="date"
                name="start"
                defaultValue={periodStart}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">
                Period end
              </span>
              <input
                type="date"
                name="end"
                defaultValue={periodEnd}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
            >
              Refresh
            </button>
          </form>
        </div>

        {/* Print header — only renders on paper. */}
        <header className="hidden print:block print:mb-6">
          <h1 className="text-2xl font-bold">
            Young General Engineering, Inc. — Close Package
          </h1>
          <p className="text-sm">
            Period: {periodStart} → {periodEnd}
          </p>
        </header>

        {/* Section 1: Trial balance. */}
        <section className="mb-8 break-inside-avoid print:mb-6">
          <h2 className="mb-2 text-lg font-bold text-yge-blue-900 print:text-black">
            1. Trial balance — through {periodEnd}
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {balances.map((b) => {
                const acc = accountByNum.get(b.accountNumber);
                return (
                  <tr key={b.accountNumber}>
                    <td className="px-3 py-1 font-mono text-xs">
                      {b.accountNumber}
                    </td>
                    <td className="px-3 py-1 text-gray-700">
                      {acc?.name ?? '—'}
                    </td>
                    <td className="px-3 py-1 text-right font-mono">
                      {b.debitCents > 0 ? <Money cents={b.debitCents} /> : ''}
                    </td>
                    <td className="px-3 py-1 text-right font-mono">
                      {b.creditCents > 0 ? <Money cents={b.creditCents} /> : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-right font-semibold">
                  Totals
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  <Money cents={totalDebit} />
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  <Money cents={totalCredit} />
                </td>
              </tr>
            </tfoot>
          </table>
          {totalDebit !== totalCredit ? (
            <p className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-800">
              ⚠ Out of balance by{' '}
              <Money cents={Math.abs(totalDebit - totalCredit)} /> — investigate
              before relying on the rest of the package.
            </p>
          ) : null}
        </section>

        {/* Section 2: Income statement. */}
        <section className="mb-8 break-before-page break-inside-avoid print:mb-6">
          <h2 className="mb-2 text-lg font-bold text-yge-blue-900 print:text-black">
            2. Income statement — {periodStart} → {periodEnd}
          </h2>
          {[
            incomeStatement.revenue,
            incomeStatement.cogs,
            incomeStatement.overhead,
            incomeStatement.otherIncome,
            incomeStatement.otherExpense,
          ].map((sec) => (
            <div key={sec.type} className="mb-3">
              <h3 className="bg-gray-50 px-3 py-1 text-sm font-semibold text-gray-800">
                {sec.label}
              </h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {sec.lines.map((line) => (
                    <tr key={line.accountNumber}>
                      <td className="px-3 py-1 font-mono text-xs">
                        {line.accountNumber}
                      </td>
                      <td className="px-3 py-1">{line.accountName}</td>
                      <td className="px-3 py-1 text-right font-mono">
                        <Money cents={line.amountCents} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-3 py-1 text-right font-semibold">
                      Subtotal
                    </td>
                    <td className="px-3 py-1 text-right font-mono font-semibold">
                      <Money cents={sec.totalCents} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
          <div className="border-t-2 border-gray-300 bg-yge-blue-50 px-3 py-2 print:bg-gray-100">
            <div className="flex items-center justify-between text-base font-bold">
              <span>Net income</span>
              <span
                className={`font-mono ${
                  incomeStatement.netIncomeCents < 0
                    ? 'text-red-700'
                    : 'text-green-700'
                }`}
              >
                <Money cents={incomeStatement.netIncomeCents} />
              </span>
            </div>
          </div>
        </section>

        {/* Section 3: Balance sheet. */}
        <section className="mb-8 break-before-page break-inside-avoid print:mb-6">
          <h2 className="mb-2 text-lg font-bold text-yge-blue-900 print:text-black">
            3. Balance sheet — as of {periodEnd}
          </h2>
          {[
            balanceSheet.assets,
            balanceSheet.liabilities,
            balanceSheet.equity,
          ].map((sec) => (
            <div key={sec.type} className="mb-3">
              <h3 className="bg-gray-50 px-3 py-1 text-sm font-semibold text-gray-800">
                {sec.label}
              </h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {sec.lines.map((line) => (
                    <tr key={line.accountNumber}>
                      <td className="px-3 py-1 font-mono text-xs">
                        {line.accountNumber}
                      </td>
                      <td className="px-3 py-1">{line.accountName}</td>
                      <td className="px-3 py-1 text-right font-mono">
                        <Money cents={line.amountCents} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-3 py-1 text-right font-semibold">
                      Subtotal
                    </td>
                    <td className="px-3 py-1 text-right font-mono font-semibold">
                      <Money cents={sec.totalCents} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
          <div className="rounded bg-gray-50 px-3 py-2 print:bg-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span>Current period earnings</span>
              <span className="font-mono">
                <Money cents={balanceSheet.currentPeriodEarningsCents} />
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-base font-bold">
              <span>Total liabilities + equity</span>
              <span className="font-mono">
                <Money cents={balanceSheet.totalLiabilitiesAndEquityCents} />
              </span>
            </div>
            {balanceSheet.imbalanceCents !== 0 ? (
              <p className="mt-1 text-xs text-red-700">
                ⚠ Out of balance by{' '}
                <Money cents={Math.abs(balanceSheet.imbalanceCents)} />.
              </p>
            ) : (
              <p className="mt-1 text-xs text-green-700">
                ✓ Books square: assets = liabilities + equity + retained.
              </p>
            )}
          </div>
        </section>

        {/* Section 4: Cash flow. */}
        <section className="mb-8 break-before-page break-inside-avoid print:mb-6">
          <h2 className="mb-2 text-lg font-bold text-yge-blue-900 print:text-black">
            4. Cash flow — {periodStart} → {periodEnd}
          </h2>
          {cashFlow.sections.map((sec) => (
            <div key={sec.activity} className="mb-3">
              <h3 className="bg-gray-50 px-3 py-1 text-sm font-semibold text-gray-800">
                {sec.label}
              </h3>
              {sec.lines.length === 0 ? (
                <p className="px-3 py-1 text-xs text-gray-500">
                  No cleared activity.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {sec.lines.map((line) => (
                      <tr key={line.label}>
                        <td className="px-3 py-1">
                          {line.label}{' '}
                          <span className="text-xs text-gray-400">
                            ({line.count})
                          </span>
                        </td>
                        <td
                          className={`px-3 py-1 text-right font-mono ${
                            line.amountCents < 0
                              ? 'text-red-700'
                              : 'text-gray-900'
                          }`}
                        >
                          <Money cents={line.amountCents} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex items-center justify-between bg-gray-50 px-3 py-1 text-sm">
                <span className="font-semibold">Subtotal — {sec.label}</span>
                <span
                  className={`font-mono font-semibold ${
                    sec.totalCents < 0 ? 'text-red-700' : 'text-gray-900'
                  }`}
                >
                  <Money cents={sec.totalCents} />
                </span>
              </div>
            </div>
          ))}
          <div className="border-t-2 border-gray-300 bg-yge-blue-50 px-3 py-2 print:bg-gray-100">
            <div className="flex items-center justify-between text-base font-bold">
              <span>Net change in cash</span>
              <span
                className={`font-mono ${
                  cashFlow.netChangeCents < 0
                    ? 'text-red-700'
                    : 'text-green-700'
                }`}
              >
                <Money cents={cashFlow.netChangeCents} />
              </span>
            </div>
          </div>
        </section>

        <p className="mt-8 text-xs text-gray-500 print:mt-4">
          Generated {new Date().toISOString().slice(0, 16)} by YGE App.
          Cash flow uses direct-method aggregation from cleared payments
          + expenses; the other three statements derive from POSTED
          journal entries.
        </p>
      </main>
    </AppShell>
  );
}
