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
  coerceLocale,
  expenseCategoryLabel,
  type Expense,
  type MileageEntry,
} from '@yge/shared';
import { getTranslator } from '../../../lib/locale';
import { cookies } from 'next/headers';
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

  const t = getTranslator();
  const localeCookie = cookies().get('yge-locale')?.value;
  const locale = coerceLocale(localeCookie);

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
          subtitle={t('reimbPg.subtitle', { id: summary.employeeId })}
          actions={
            <span className="flex gap-2">
              <LinkButton href={`/reimbursements/${summary.employeeId}/print`} variant="secondary" size="md">
                {t('reimbPg.print')}
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
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('reimbPg.tileMileage')}</div>
            <div className="mt-1 text-2xl font-bold"><Money cents={summary.totalMileageCents} /></div>
          </Card>
          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('reimbPg.tileExpenses')}</div>
            <div className="mt-1 text-2xl font-bold"><Money cents={summary.totalExpenseCents} /></div>
          </Card>
          <Card className={summary.totalCents > 0 ? 'border-amber-300 bg-amber-50' : ''}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('reimbPg.tileTotal')}</div>
            <div className={`mt-1 text-2xl font-bold ${summary.totalCents > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
              <Money cents={summary.totalCents} />
            </div>
          </Card>
        </section>

        {summary.totalCents === 0 ? (
          <Alert tone="success">
            {t('reimbPg.nothingOwed', { name: summary.employeeName })}
          </Alert>
        ) : (
          <>
            {summary.mileageRows.length > 0 ? (
              <Card className="mb-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {t('reimbPg.mileageHeader', { count: summary.mileageRows.length, miles: summary.totalMiles.toFixed(1) })}
                </h2>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-300 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-1">{t('reimbPg.thDate')}</th>
                      <th className="py-1">{t('reimbPg.thVehicle')}</th>
                      <th className="py-1 text-right">{t('reimbPg.thMiles')}</th>
                      <th className="py-1 text-right">{t('reimbPg.thRate')}</th>
                      <th className="py-1 text-right">{t('reimbPg.thReimburse')}</th>
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
                      <td colSpan={4} className="py-2">{t('reimbPg.subtotal')}</td>
                      <td className="py-2 text-right"><Money cents={summary.totalMileageCents} /></td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            ) : null}

            {summary.expenseRows.length > 0 ? (
              <Card className="mb-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {t('reimbPg.expensesHeader', { count: summary.expenseRows.length })}
                </h2>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-300 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-1">{t('reimbPg.thDate')}</th>
                      <th className="py-1">{t('reimbPg.thVendor')}</th>
                      <th className="py-1">{t('reimbPg.thDescription')}</th>
                      <th className="py-1">{t('reimbPg.thCategory')}</th>
                      <th className="py-1 text-right">{t('reimbPg.thAmount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.expenseRows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1 font-mono text-xs text-gray-700">{r.receiptDate}</td>
                        <td className="py-1 text-sm">{r.vendor}</td>
                        <td className="py-1 text-sm">{r.description}</td>
                        <td className="py-1 text-xs text-gray-700">{expenseCategoryLabel(r.category, locale)}</td>
                        <td className="py-1 text-right"><Money cents={r.amountCents} /></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-black font-semibold">
                      <td colSpan={4} className="py-2">{t('reimbPg.subtotal')}</td>
                      <td className="py-2 text-right"><Money cents={summary.totalExpenseCents} /></td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            ) : null}

            <div className="rounded-md border-2 border-black bg-white p-4 text-base font-semibold">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide">{t('reimbPg.tileTotal')}</span>
                <Money cents={summary.totalCents} className="text-lg" />
              </div>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
