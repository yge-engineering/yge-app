// /reimbursements — list of employees with outstanding mileage +
// expense reimbursement owed.
//
// Plain English: per-employee bundles of unreimbursed mileage and
// out-of-pocket receipts. Click into an employee to see the breakdown,
// print, and mark all paid in one click.

import Link from 'next/link';

import {
  Alert,
  AppShell,
  DataTable,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import {
  buildAllReimbursementSummaries,
  computeReimbursementGrandTotals,
  type Expense,
  type MileageEntry,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchMileage(): Promise<MileageEntry[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/mileage`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { entries: MileageEntry[] }).entries;
  } catch { return []; }
}
async function fetchExpenses(): Promise<Expense[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/expenses`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { expenses: Expense[] }).expenses;
  } catch { return []; }
}

export default async function ReimbursementsPage() {
  const [mileage, expenses] = await Promise.all([fetchMileage(), fetchExpenses()]);
  const summaries = buildAllReimbursementSummaries({ mileage, expenses });
  const totals = computeReimbursementGrandTotals(summaries);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Reimbursements owed"
          subtitle="Per-employee bundles of outstanding mileage and out-of-pocket expense receipts. Click into an employee to see the breakdown, print, and mark all paid in one click."
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Employees owed" value={totals.employees} />
          <Tile label="Mileage" value={<Money cents={totals.mileageCents} />} />
          <Tile label="Expenses" value={<Money cents={totals.expenseCents} />} />
          <Tile
            label="Total owed"
            value={<Money cents={totals.totalCents} />}
            tone={totals.totalCents > 0 ? 'warn' : 'success'}
          />
        </section>

        {summaries.length === 0 ? (
          <Alert tone="success">
            ✓ Nothing owed. Every personal-vehicle mile and every out-of-pocket receipt has been reimbursed.
          </Alert>
        ) : (
          <DataTable
            rows={summaries.map((s) => ({ ...s, id: s.employeeId }))}
            keyFn={(s) => s.employeeId}
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                cell: (s) => (
                  <Link href={`/reimbursements/${s.employeeId}`} className="text-sm font-medium text-blue-700 hover:underline">
                    {s.employeeName}
                    <div className="text-[10px] font-mono text-gray-500">{s.employeeId}</div>
                  </Link>
                ),
              },
              { key: 'miles', header: 'Miles', numeric: true, cell: (s) => <span className="font-mono text-xs text-gray-700">{s.totalMiles.toFixed(1)}</span> },
              { key: 'mileage', header: 'Mileage $', numeric: true, cell: (s) => <Money cents={s.totalMileageCents} /> },
              { key: 'receipts', header: 'Receipts', numeric: true, cell: (s) => <span className="font-mono text-xs text-gray-700">{s.expenseRows.length}</span> },
              { key: 'expense', header: 'Expense $', numeric: true, cell: (s) => <Money cents={s.totalExpenseCents} /> },
              {
                key: 'total',
                header: 'Total owed',
                numeric: true,
                cell: (s) => <Money cents={s.totalCents} className="text-base font-semibold" />,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
