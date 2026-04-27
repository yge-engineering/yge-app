// /expenses — employee expense reimbursement list.

import Link from 'next/link';
import {
  computeExpenseRollup,
  expenseCategoryLabel,
  expenseReimbursableCents,
  formatUSD,
  type Expense,
  type ExpenseCategory,
} from '@yge/shared';

const CATEGORIES: ExpenseCategory[] = [
  'MEAL',
  'PER_DIEM',
  'LODGING',
  'FUEL',
  'PARKING',
  'TOLLS',
  'MATERIAL',
  'TOOL_PURCHASE',
  'PERMIT_FEE',
  'TRAINING_FEE',
  'AGENCY_FEE',
  'OFFICE_SUPPLIES',
  'OTHER',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchExpenses(filter: {
  category?: string;
  reimbursed?: string;
}): Promise<Expense[]> {
  const url = new URL(`${apiBaseUrl()}/api/expenses`);
  if (filter.category) url.searchParams.set('category', filter.category);
  if (filter.reimbursed) url.searchParams.set('reimbursed', filter.reimbursed);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { expenses: Expense[] }).expenses;
}
async function fetchAll(): Promise<Expense[]> {
  const res = await fetch(`${apiBaseUrl()}/api/expenses`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { expenses: Expense[] }).expenses;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { category?: string; reimbursed?: string };
}) {
  const [expenses, all] = await Promise.all([fetchExpenses(searchParams), fetchAll()]);
  const rollup = computeExpenseRollup(all);

  function buildHref(overrides: Partial<{ category?: string; reimbursed?: string }>) {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.category) params.set('category', merged.category);
    if (merged.reimbursed) params.set('reimbursed', merged.reimbursed);
    const q = params.toString();
    return q ? `/expenses?${q}` : '/expenses';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`${publicApiBaseUrl()}/api/expenses?format=csv${searchParams.category ? '&category=' + encodeURIComponent(searchParams.category) : ''}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Download CSV
          </a>
          <Link
            href="/expenses/new"
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + Log expense
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Expense Reimbursements</h1>
      <p className="mt-2 text-gray-700">
        Out-of-pocket receipts owed back to employees. Company-card entries
        are tracked here too but excluded from reimbursable totals — they
        flow through AP on the card statement.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Receipts" value={rollup.total} />
        <Stat label="Total spend" value={formatUSD(rollup.totalCents)} />
        <Stat label="Reimbursable" value={formatUSD(rollup.reimbursableCents)} />
        <Stat
          label="Owed to employees"
          value={formatUSD(rollup.outstandingCents)}
          variant={rollup.outstandingCents > 0 ? 'warn' : 'ok'}
        />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Category:</span>
        <Link
          href={buildHref({ category: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.category ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={buildHref({ category: c })}
            className={`rounded px-2 py-1 text-xs ${searchParams.category === c ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {expenseCategoryLabel(c)}
          </Link>
        ))}
        <span className="ml-3 text-xs uppercase tracking-wide text-gray-500">Status:</span>
        <Link
          href={buildHref({ reimbursed: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.reimbursed ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        <Link
          href={buildHref({ reimbursed: 'false' })}
          className={`rounded px-2 py-1 text-xs ${searchParams.reimbursed === 'false' ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          Owed
        </Link>
        <Link
          href={buildHref({ reimbursed: 'true' })}
          className={`rounded px-2 py-1 text-xs ${searchParams.reimbursed === 'true' ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          Paid
        </Link>
      </section>

      {expenses.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No expenses in this filter. Click <em>Log expense</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">Reimburse</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((e) => {
                const reimb = expenseReimbursableCents(e);
                return (
                  <tr key={e.id} className={!e.reimbursed && reimb > 0 ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {e.receiptDate}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{e.employeeName}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-gray-900">{e.vendor}</div>
                      <div className="line-clamp-1 text-xs text-gray-500">{e.description}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {expenseCategoryLabel(e.category)}
                      {e.paidWithCompanyCard && (
                        <div className="mt-0.5 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">
                          Co. card
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatUSD(e.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {reimb > 0 ? formatUSD(reimb) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {e.paidWithCompanyCard ? (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 font-semibold text-purple-800">
                          Card
                        </span>
                      ) : e.reimbursed ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800">
                          Paid
                        </span>
                      ) : (
                        <span className="rounded bg-yellow-100 px-1.5 py-0.5 font-semibold text-yellow-800">
                          Owed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/expenses/${e.id}`} className="text-yge-blue-500 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
