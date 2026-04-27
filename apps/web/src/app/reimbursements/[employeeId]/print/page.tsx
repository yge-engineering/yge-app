// /reimbursements/[employeeId]/print — printable single-page summary
// the bookkeeper attaches to the next paycheck.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildEmployeeReimbursementSummary,
  expenseCategoryLabel,
  formatUSD,
  type Expense,
  type MileageEntry,
} from '@yge/shared';
import { PrintButton } from '@/components/print-button';
import { Letterhead } from '@/components/letterhead';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
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

export default async function ReimbursementPrintPage({
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
    <main className="mx-auto max-w-3xl p-8 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/reimbursements/${summary.employeeId}`}
          className="text-sm text-yge-blue-500 hover:underline"
        >
          &larr; Back
        </Link>
        <PrintButton />
      </div>

      <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
        <Letterhead />

        <header className="mb-4 mt-4 border-b-2 border-black pb-2">
          <div className="text-xs uppercase tracking-wide">
            Employee Reimbursement Summary
          </div>
          <h1 className="text-2xl font-bold">{summary.employeeName}</h1>
          <p className="text-xs text-gray-600">
            Generated {new Date().toISOString().slice(0, 10)}
          </p>
        </header>

        {summary.mileageRows.length > 0 && (
          <section className="mb-4">
            <h2 className="rounded bg-gray-200 px-2 py-1 text-xs font-bold uppercase">
              Mileage ({summary.totalMiles.toFixed(1)} mi)
            </h2>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-400 text-left">
                  <th className="px-1 py-1">Date</th>
                  <th className="px-1 py-1">Vehicle / route</th>
                  <th className="w-16 px-1 py-1 text-right">Miles</th>
                  <th className="w-12 px-1 py-1 text-right">Rate</th>
                  <th className="w-20 px-1 py-1 text-right">Reimburse</th>
                </tr>
              </thead>
              <tbody>
                {summary.mileageRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200 align-top">
                    <td className="px-1 py-1 font-mono">{r.tripDate}</td>
                    <td className="px-1 py-1">
                      <div>{r.vehicleDescription}</div>
                      {r.description && <div className="text-gray-600">{r.description}</div>}
                    </td>
                    <td className="px-1 py-1 text-right font-mono">
                      {r.businessMiles.toFixed(1)}
                    </td>
                    <td className="px-1 py-1 text-right font-mono">
                      {r.irsRateCentsPerMile}¢
                    </td>
                    <td className="px-1 py-1 text-right font-mono">
                      {formatUSD(r.reimburseCents)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-black font-semibold">
                  <td colSpan={4} className="px-1 py-1">Mileage subtotal</td>
                  <td className="px-1 py-1 text-right font-mono">
                    {formatUSD(summary.totalMileageCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {summary.expenseRows.length > 0 && (
          <section className="mb-4">
            <h2 className="rounded bg-gray-200 px-2 py-1 text-xs font-bold uppercase">
              Expense receipts ({summary.expenseRows.length})
            </h2>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-400 text-left">
                  <th className="px-1 py-1">Date</th>
                  <th className="px-1 py-1">Vendor</th>
                  <th className="px-1 py-1">Description</th>
                  <th className="w-24 px-1 py-1">Category</th>
                  <th className="w-20 px-1 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.expenseRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200 align-top">
                    <td className="px-1 py-1 font-mono">{r.receiptDate}</td>
                    <td className="px-1 py-1">{r.vendor}</td>
                    <td className="px-1 py-1">{r.description}</td>
                    <td className="px-1 py-1">{expenseCategoryLabel(r.category)}</td>
                    <td className="px-1 py-1 text-right font-mono">
                      {formatUSD(r.amountCents)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-black font-semibold">
                  <td colSpan={4} className="px-1 py-1">Expenses subtotal</td>
                  <td className="px-1 py-1 text-right font-mono">
                    {formatUSD(summary.totalExpenseCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        <div className="mt-6 rounded border-2 border-black p-3 text-base font-bold">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-wide">Total Reimbursable</span>
            <span className="font-mono text-lg">{formatUSD(summary.totalCents)}</span>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="font-semibold uppercase">Employee acknowledgement</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
            <div className="mt-1 text-gray-600">{summary.employeeName}</div>
          </div>
          <div>
            <div className="font-semibold uppercase">Date paid</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
          </div>
        </section>

        <p className="mt-6 text-[10px] italic text-gray-600">
          Reimbursable amounts are not subject to payroll tax under IRS
          Accountable Plan rules (Pub. 463, Treas. Reg. §1.62-2). Mileage at
          IRS standard rate; out-of-pocket expense at receipted amount.
        </p>
      </article>
    </main>
  );
}
