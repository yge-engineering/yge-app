// /reimbursements — list of employees with outstanding mileage + expense
// reimbursement owed.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  buildAllReimbursementSummaries,
  computeReimbursementGrandTotals,
  formatUSD,
  type Expense,
  type MileageEntry,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchMileage(): Promise<MileageEntry[]> {
  const res = await fetch(`${apiBaseUrl()}/api/mileage`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { entries: MileageEntry[] }).entries;
}
async function fetchExpenses(): Promise<Expense[]> {
  const res = await fetch(`${apiBaseUrl()}/api/expenses`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { expenses: Expense[] }).expenses;
}

export default async function ReimbursementsPage() {
  const [mileage, expenses] = await Promise.all([fetchMileage(), fetchExpenses()]);
  const summaries = buildAllReimbursementSummaries({ mileage, expenses });
  const totals = computeReimbursementGrandTotals(summaries);

  return (
    <AppShell>
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Reimbursements Owed</h1>
      <p className="mt-2 text-gray-700">
        Per-employee bundles of outstanding mileage and out-of-pocket expense
        receipts. Click into an employee to see the breakdown, print, and
        mark all paid in one click.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Employees owed" value={totals.employees} />
        <Stat label="Mileage" value={formatUSD(totals.mileageCents)} />
        <Stat label="Expenses" value={formatUSD(totals.expenseCents)} />
        <Stat
          label="Total owed"
          value={formatUSD(totals.totalCents)}
          variant={totals.totalCents > 0 ? 'warn' : 'ok'}
        />
      </section>

      {summaries.length === 0 ? (
        <div className="mt-6 rounded border border-green-300 bg-green-50 p-6 text-sm text-green-900">
          ✓ Nothing owed. Every personal-vehicle mile and every out-of-pocket
          receipt has been reimbursed.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2 text-right">Miles</th>
                <th className="px-4 py-2 text-right">Mileage $</th>
                <th className="px-4 py-2 text-right">Receipts</th>
                <th className="px-4 py-2 text-right">Expense $</th>
                <th className="px-4 py-2 text-right">Total owed</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summaries.map((s) => (
                <tr key={s.employeeId}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {s.employeeName}
                    <div className="text-[10px] font-mono text-gray-500">{s.employeeId}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                    {s.totalMiles.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {formatUSD(s.totalMileageCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                    {s.expenseRows.length}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {formatUSD(s.totalExpenseCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-base font-semibold">
                    {formatUSD(s.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      href={`/reimbursements/${s.employeeId}`}
                      className="text-yge-blue-500 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </AppShell>
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
