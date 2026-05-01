// /expenses — employee expense reimbursement list.
//
// Plain English: out-of-pocket receipts owed back to employees.
// Company-card entries are tracked here too but excluded from
// reimbursable totals — they flow through AP on the card statement.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import {
  computeExpenseRollup,
  expenseCategoryLabel,
  expenseReimbursableCents,
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
  try {
    const url = new URL(`${apiBaseUrl()}/api/expenses`);
    if (filter.category) url.searchParams.set('category', filter.category);
    if (filter.reimbursed) url.searchParams.set('reimbursed', filter.reimbursed);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { expenses: Expense[] }).expenses;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<Expense[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/expenses`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { expenses: Expense[] }).expenses;
  } catch {
    return [];
  }
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

  const csvHref = `${publicApiBaseUrl()}/api/expenses?format=csv${
    searchParams.category ? '&category=' + encodeURIComponent(searchParams.category) : ''
  }`;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Expense reimbursements"
          subtitle="Out-of-pocket receipts owed back to employees. Company-card entries are tracked here too but excluded from reimbursable totals — they flow through AP on the card statement."
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Download CSV
              </a>
              <LinkButton href="/expenses/new" variant="primary" size="md">
                + Log expense
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Receipts" value={rollup.total} />
          <Tile label="Total spend" value={<Money cents={rollup.totalCents} />} />
          <Tile label="Reimbursable" value={<Money cents={rollup.reimbursableCents} />} />
          <Tile
            label="Owed to employees"
            value={<Money cents={rollup.outstandingCents} />}
            tone={rollup.outstandingCents > 0 ? 'warn' : 'success'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Category:</span>
          <Link
            href={buildHref({ category: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.category ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={buildHref({ category: c })}
              className={`rounded px-2 py-1 text-xs ${searchParams.category === c ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {expenseCategoryLabel(c)}
            </Link>
          ))}
          <span className="ml-3 text-xs uppercase tracking-wide text-gray-500">Status:</span>
          <Link
            href={buildHref({ reimbursed: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.reimbursed ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          <Link
            href={buildHref({ reimbursed: 'false' })}
            className={`rounded px-2 py-1 text-xs ${searchParams.reimbursed === 'false' ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Owed
          </Link>
          <Link
            href={buildHref({ reimbursed: 'true' })}
            className={`rounded px-2 py-1 text-xs ${searchParams.reimbursed === 'true' ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Paid
          </Link>
        </section>

        {expenses.length === 0 ? (
          <EmptyState
            title="No expenses in this filter"
            body="Receipts go here. Anything paid with personal funds gets paid back; anything paid with the company card just gets categorized so AP can match the statement."
            actions={[{ href: '/expenses/new', label: 'Log expense', primary: true }]}
          />
        ) : (
          <DataTable
            rows={expenses}
            keyFn={(e) => e.id}
            columns={[
              {
                key: 'date',
                header: 'Date',
                cell: (e) => (
                  <Link href={`/expenses/${e.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {e.receiptDate}
                  </Link>
                ),
              },
              { key: 'employee', header: 'Employee', cell: (e) => <span className="text-sm text-gray-900">{e.employeeName}</span> },
              {
                key: 'vendor',
                header: 'Vendor',
                cell: (e) => (
                  <div className="text-sm">
                    <div className="text-gray-900">{e.vendor}</div>
                    <div className="line-clamp-1 text-xs text-gray-500">{e.description}</div>
                  </div>
                ),
              },
              {
                key: 'category',
                header: 'Category',
                cell: (e) => (
                  <span className="text-xs text-gray-700">
                    {expenseCategoryLabel(e.category)}
                    {e.paidWithCompanyCard ? (
                      <span className="ml-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">Co. card</span>
                    ) : null}
                  </span>
                ),
              },
              { key: 'amount', header: 'Amount', numeric: true, cell: (e) => <Money cents={e.amountCents} /> },
              {
                key: 'reimburse',
                header: 'Reimburse',
                numeric: true,
                cell: (e) => {
                  const reimb = expenseReimbursableCents(e);
                  return reimb > 0 ? <Money cents={reimb} /> : <span className="font-mono text-gray-400">—</span>;
                },
              },
              {
                key: 'status',
                header: 'Status',
                cell: (e) => {
                  if (e.paidWithCompanyCard) return <StatusPill label="Card" tone="info" />;
                  if (e.reimbursed) return <StatusPill label="Paid" tone="success" />;
                  return <StatusPill label="Owed" tone="warn" />;
                },
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
