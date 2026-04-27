// /reimbursements/[employeeId] — single-employee reimbursement detail.
//
// Pulls every outstanding mileage + expense entry for the employee and
// renders them on one page with a "Mark all paid" action.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildEmployeeReimbursementSummary,
  expenseCategoryLabel,
  formatUSD,
  type Expense,
  type MileageEntry,
} from '@yge/shared';
import { ReimbursementMarkPaidButton } from '../../../components/reimbursement-mark-paid-button';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchMileage(employeeId: string): Promise<MileageEntry[]> {
  const url = new URL(`${apiBaseUrl()}/api/mileage`);
  url.searchParams.set('employeeId', employeeId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { entries: MileageEntry[] }).entries;
}
async function fetchExpenses(employeeId: string): Promise<Expense[]> {
  const url = new URL(`${apiBaseUrl()}/api/expenses`);
  url.searchParams.set('employeeId', employeeId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { expenses: Expense[] }).expenses;
}

export default async function EmployeeReimbursementPage({
  params,
}: {
  params: { employeeId: string };
}) {
  const [mileage, expenses] = await Promise.all([
    fetchMileage(params.employeeId),
    fetchExpenses(params.employeeId),
  ]);
  // Pull a name from any record we have for this employee.
  const employeeName =
    mileage[0]?.employeeName ?? expenses[0]?.employeeName ?? params.employeeId;

  const summary = buildEmployeeReimbursementSummary({
    employeeId: params.employeeId,
    employeeName,
    mileage,
    expenses,
  });
  if (summary.totalCents === 0 && mileage.length === 0 && expenses.length === 0) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/reimbursements" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Reimbursements
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/reimbursements/${summary.employeeId}/print`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Print
          </Link>
          {summary.totalCents > 0 && (
            <ReimbursementMarkPaidButton
              apiBaseUrl={publicApiBaseUrl()}
              mileageIds={summary.mileageRows.map((r) => r.id)}
              expenseIds={summary.expenseRows.map((r) => r.id)}
              totalCents={summary.totalCents}
            />
          )}
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">
        {summary.employeeName}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Reimbursement summary · {summary.employeeId}
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Mileage" value={formatUSD(summary.totalMileageCents)} />
        <Stat label="Expenses" value={formatUSD(summary.totalExpenseCents)} />
        <Stat
          label="Total owed"
          value={formatUSD(summary.totalCents)}
          variant={summary.totalCents > 0 ? 'warn' : 'ok'}
        />
      </section>

      {summary.totalCents === 0 ? (
        <div className="mt-6 rounded border border-green-300 bg-green-50 p-6 text-sm text-green-900">
          ✓ Nothing owed to {summary.employeeName} right now.
        </div>
      ) : (
        <>
          {summary.mileageRows.length > 0 && (
            <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Mileage ({summary.mileageRows.length} · {summary.totalMiles.toFixed(1)} mi)
              </h2>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-300 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-1">Date</th>
                    <th className="py-1">Vehicle / route</th>
                    <th className="py-1 text-right">Miles</th>
                    <th className="py-1 text-right">Rate</th>
                    <th className="py-1 text-right">Reimburse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.mileageRows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1 font-mono text-xs text-gray-700">{r.tripDate}</td>
                      <td className="py-1 text-sm">
                        <div>{r.vehicleDescription}</div>
                        {r.description && (
                          <div className="text-xs text-gray-500">{r.description}</div>
                        )}
                      </td>
                      <td className="py-1 text-right font-mono text-sm">
                        {r.businessMiles.toFixed(1)}
                      </td>
                      <td className="py-1 text-right font-mono text-xs text-gray-700">
                        {r.irsRateCentsPerMile}¢
                      </td>
                      <td className="py-1 text-right font-mono text-sm">
                        {formatUSD(r.reimburseCents)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-black font-semibold">
                    <td colSpan={4} className="py-2">Subtotal</td>
                    <td className="py-2 text-right font-mono">
                      {formatUSD(summary.totalMileageCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {summary.expenseRows.length > 0 && (
            <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Expense receipts ({summary.expenseRows.length})
              </h2>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-300 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-1">Date</th>
                    <th className="py-1">Vendor</th>
                    <th className="py-1">Description</th>
                    <th className="py-1">Category</th>
                    <th className="py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.expenseRows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1 font-mono text-xs text-gray-700">{r.receiptDate}</td>
                      <td className="py-1 text-sm">{r.vendor}</td>
                      <td className="py-1 text-sm">{r.description}</td>
                      <td className="py-1 text-xs text-gray-700">
                        {expenseCategoryLabel(r.category)}
                      </td>
                      <td className="py-1 text-right font-mono text-sm">
                        {formatUSD(r.amountCents)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-black font-semibold">
                    <td colSpan={4} className="py-2">Subtotal</td>
                    <td className="py-2 text-right font-mono">
                      {formatUSD(summary.totalExpenseCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          <div className="mt-6 rounded-lg border-2 border-black bg-white p-4 text-base font-semibold">
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-wide">Total owed</span>
              <span className="font-mono text-lg">{formatUSD(summary.totalCents)}</span>
            </div>
          </div>
        </>
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
