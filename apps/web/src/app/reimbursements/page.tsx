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
import { getTranslator } from '../../lib/locale';
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
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title={t('reimb.title')}
          subtitle={t('reimb.subtitle')}
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('reimb.tile.employees')} value={totals.employees} />
          <Tile label={t('reimb.tile.mileage')} value={<Money cents={totals.mileageCents} />} />
          <Tile label={t('reimb.tile.expenses')} value={<Money cents={totals.expenseCents} />} />
          <Tile
            label={t('reimb.tile.total')}
            value={<Money cents={totals.totalCents} />}
            tone={totals.totalCents > 0 ? 'warn' : 'success'}
          />
        </section>

        {summaries.length === 0 ? (
          <Alert tone="success">
            {t('reimb.allClear')}
          </Alert>
        ) : (
          <DataTable
            rows={summaries.map((s) => ({ ...s, id: s.employeeId }))}
            keyFn={(s) => s.employeeId}
            columns={[
              {
                key: 'employee',
                header: t('reimb.col.employee'),
                cell: (s) => (
                  <Link href={`/reimbursements/${s.employeeId}`} className="text-sm font-medium text-blue-700 hover:underline">
                    {s.employeeName}
                    <div className="text-[10px] font-mono text-gray-500">{s.employeeId}</div>
                  </Link>
                ),
              },
              { key: 'miles', header: t('reimb.col.miles'), numeric: true, cell: (s) => <span className="font-mono text-xs text-gray-700">{s.totalMiles.toFixed(1)}</span> },
              { key: 'mileage', header: t('reimb.col.mileageDollars'), numeric: true, cell: (s) => <Money cents={s.totalMileageCents} /> },
              { key: 'receipts', header: t('reimb.col.receipts'), numeric: true, cell: (s) => <span className="font-mono text-xs text-gray-700">{s.expenseRows.length}</span> },
              { key: 'expense', header: t('reimb.col.expenseDollars'), numeric: true, cell: (s) => <Money cents={s.totalExpenseCents} /> },
              {
                key: 'total',
                header: t('reimb.col.total'),
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
