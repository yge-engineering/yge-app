// /reimbursements/[employeeId]/print — printable single-page summary
// the bookkeeper attaches to the next paycheck.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildEmployeeReimbursementSummary,
  coerceLocale,
  expenseCategoryLabel,
  formatUSD,
  type Expense,
  type MileageEntry,
} from '@yge/shared';
import { getTranslator } from '../../../../lib/locale';
import { cookies } from 'next/headers';
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

  const t = getTranslator();
  const localeCookie = cookies().get('yge-locale')?.value;
  const locale = coerceLocale(localeCookie);

  return (
    <main className="mx-auto max-w-3xl p-8 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/reimbursements/${summary.employeeId}`}
          className="text-sm text-yge-blue-500 hover:underline"
        >
          {t('handoutPg.back')}
        </Link>
        <PrintButton />
      </div>

      <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
        <Letterhead />

        <header className="mb-4 mt-4 border-b-2 border-black pb-2">
          <div className="text-xs uppercase tracking-wide">
            {t('reimbPrint.docTitle')}
          </div>
          <h1 className="text-2xl font-bold">{summary.employeeName}</h1>
          <p className="text-xs text-gray-600">
            {t('prequalPg.generated', { date: new Date().toISOString().slice(0, 10) })}
          </p>
        </header>

        {summary.mileageRows.length > 0 && (
          <section className="mb-4">
            <h2 className="rounded bg-gray-200 px-2 py-1 text-xs font-bold uppercase">
              {t('reimbPrint.mileageHeader', { miles: summary.totalMiles.toFixed(1) })}
            </h2>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-400 text-left">
                  <th className="px-1 py-1">{t('reimbPg.thDate')}</th>
                  <th className="px-1 py-1">{t('reimbPg.thVehicle')}</th>
                  <th className="w-16 px-1 py-1 text-right">{t('reimbPg.thMiles')}</th>
                  <th className="w-12 px-1 py-1 text-right">{t('reimbPg.thRate')}</th>
                  <th className="w-20 px-1 py-1 text-right">{t('reimbPg.thReimburse')}</th>
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
                  <td colSpan={4} className="px-1 py-1">{t('reimbPrint.mileageSubtotal')}</td>
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
              {t('reimbPg.expensesHeader', { count: summary.expenseRows.length })}
            </h2>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-400 text-left">
                  <th className="px-1 py-1">{t('reimbPg.thDate')}</th>
                  <th className="px-1 py-1">{t('reimbPg.thVendor')}</th>
                  <th className="px-1 py-1">{t('reimbPg.thDescription')}</th>
                  <th className="w-24 px-1 py-1">{t('reimbPg.thCategory')}</th>
                  <th className="w-20 px-1 py-1 text-right">{t('reimbPg.thAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.expenseRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200 align-top">
                    <td className="px-1 py-1 font-mono">{r.receiptDate}</td>
                    <td className="px-1 py-1">{r.vendor}</td>
                    <td className="px-1 py-1">{r.description}</td>
                    <td className="px-1 py-1">{expenseCategoryLabel(r.category, locale)}</td>
                    <td className="px-1 py-1 text-right font-mono">
                      {formatUSD(r.amountCents)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-black font-semibold">
                  <td colSpan={4} className="px-1 py-1">{t('reimbPrint.expenseSubtotal')}</td>
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
            <span className="uppercase tracking-wide">{t('reimbPrint.totalReimbursable')}</span>
            <span className="font-mono text-lg">{formatUSD(summary.totalCents)}</span>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="font-semibold uppercase">{t('reimbPrint.empAck')}</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
            <div className="mt-1 text-gray-600">{summary.employeeName}</div>
          </div>
          <div>
            <div className="font-semibold uppercase">{t('reimbPrint.datePaid')}</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
          </div>
        </section>

        <p className="mt-6 text-[10px] italic text-gray-600">
          {t('reimbPrint.taxNote')}
        </p>
      </article>
    </main>
  );
}
