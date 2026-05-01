// /reimbursements/[employeeId] — single-employee reimbursement detail.
//
// Plain English: every outstanding mileage + expense entry for one
// employee, on one page, with a "Mark all paid" action that flips the
// reimbursed flag in bulk after they've been cut a check.

import { notFound } from 'next/navigation';

import {
  Alert,
  AppShell,
  Avatar,
  Card,
  LinkButton,
  Money,
  PageHeader,
} from '../../../components';
import {
  buildEmployeeReimbursementSummary,
  expenseCategoryLabel,
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
  try {
    const url = new URL(`${apiBaseUrl()}/api/mileage`);
    url.searchParams.set('employeeId', employeeId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { entries: MileageEntry[] }).entries;
  } catch { return []; }
}
async function fetchExpenses(employeeId: string): Promise<Expense[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/expenses`);
    url.searchParams.set('employeeId', employeeId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { expenses: Expense[] }).expenses;
  } catch { return []; }
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
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              <Avatar name={summary.employeeName} size="lg" />
              {summary.employeeName}
            </span>
          }
          subtitle={`Reimbursement summary · ${summary.employeeId}`}
          actions={
            <span className="flex gap-2">
              <LinkButton href={`/reimbursements/${summary.employeeId}/print`} variant="secondary" size="md">
                Print
              </LinkButton>
              {summary.totalCents > 0 ? (
                <ReimbursementMarkPaidButton
                  apiBaseUrl={publicApiBaseUrl()}
                  mileageIds={summary.mileageRows.map((r) => r.id)}
                  expenseIds={summary.expenseRows.map((r) => r.id)}
                  totalCents={summary.totalCents}
                />
              ) : null}
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Mileage</div>
            <div className="mt-1 text-2xl font-bold"><Money cents={summary.totalMileageCents} /></div>
          </Card>
          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Expenses</div>
            <div className="mt-1 text-2xl font-bold"><Money cents={summary.totalExpenseCents} /></div>
          </Card>
          <Card className={summary.totalCents > 0 ? 'border-amber-300 bg-amber-50' : ''}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Total owed</div>
            <div className={`mt-1 text-2xl font-bold ${summary.totalCents > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
              <Money cents={summary.totalCents} />
            </div>
          </Card>
        </section>

        {summary.totalCents === 0 ? (
          <Alert tone="success">
            ✓ Nothing owed to {summary.employeeName} right now.
          </Alert>
        ) : (
          <>
            {summary.mileageRows.length > 0 ? (
              <Card className="mb-4">
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
                          {r.description ? <div className="text-xs text-gray-500">{r.description}</div> : null}
                        </td>
                        <td className="py-1 text-right font-mono text-sm">{r.businessMiles.toFixed(1)}</td>
                        <td className="py-1 text-right font-mono text-xs text-gray-700">
                          {r.irsRateCentsPerMile}¢
                        </td>
                        <td className="py-1 text-right"><Money cents={r.reimburseCents} /></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-black font-semibold">
                      <td colSpan={4} className="py-2">Subtotal</td>
                      <td className="py-2 text-right"><Money cents={summary.totalMileageCents} /></td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            ) : null}

            {summary.expenseRows.length > 0 ? (
              <Card className="mb-4">
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
                        <td className="py-1 text-xs text-gray-700">{expenseCategoryLabel(r.category)}</td>
                        <td className="py-1 text-right"><Money cents={r.amountCents} /></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-black font-semibold">
                      <td colSpan={4} className="py-2">Subtotal</td>
                      <td className="py-2 text-right"><Money cents={summary.totalExpenseCents} /></td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            ) : null}

            <div className="rounded-md border-2 border-black bg-white p-4 text-base font-semibold">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide">Total owed</span>
                <Money cents={summary.totalCents} className="text-lg" />
              </div>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
