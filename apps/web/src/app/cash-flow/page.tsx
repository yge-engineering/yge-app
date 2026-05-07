// /cash-flow — direct-method cash flow statement.
//
// Aggregates cleared AR receipts, AP outflows, and expenses for the
// selected period. Pairs with /trial-balance, /income-statement,
// /balance-sheet, /wip as the monthly-close report set.

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import { requirePermission } from '../../lib/permissions';
import {
  buildCashFlow,
  type ApPayment,
  type ArPayment,
  type Expense,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchArPayments(): Promise<ArPayment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-payments`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ArPayment[] }).payments;
  } catch {
    return [];
  }
}

async function fetchApPayments(): Promise<ApPayment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ap-payments`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ApPayment[] }).payments;
  } catch {
    return [];
  }
}

async function fetchExpenses(): Promise<Expense[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/expenses`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { expenses: Expense[] }).expenses;
  } catch {
    return [];
  }
}

function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  requirePermission('financials:view');
  const def = defaultPeriod();
  const periodStart = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.start ?? '')
    ? (searchParams.start as string)
    : def.start;
  const periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.end ?? '')
    ? (searchParams.end as string)
    : def.end;

  const [arPayments, apPayments, expenses] = await Promise.all([
    fetchArPayments(),
    fetchApPayments(),
    fetchExpenses(),
  ]);
  const stmt = buildCashFlow({
    arPayments,
    apPayments,
    expenses,
    periodStart,
    periodEnd,
  });
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title={t('cf.title')}
          subtitle={t('cf.subtitle')}
        />

        <form action="/cash-flow" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">
              {t('cf.periodStart')}
            </span>
            <input
              type="date"
              name="start"
              defaultValue={periodStart}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">
              {t('cf.periodEnd')}
            </span>
            <input
              type="date"
              name="end"
              defaultValue={periodEnd}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
          >
            {t('cf.refresh')}
          </button>
          <span className="ml-auto text-xs text-gray-600">
            {t('cf.basedOn', {
              ar: stmt.arPaymentsCount,
              ap: stmt.apPaymentsCount,
              exp: stmt.expensesCount,
            })}
          </span>
        </form>

        <div className="rounded-md border border-gray-200 bg-white">
          {stmt.sections.map((section) => (
            <section
              key={section.activity}
              className="border-b border-gray-100 last:border-b-0"
            >
              <header className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                {section.label}
              </header>
              {section.lines.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-500">
                  {t('cf.noActivity')}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {section.lines.map((line) => (
                      <tr
                        key={line.label}
                        className="border-t border-gray-100"
                      >
                        <td className="px-4 py-2 text-gray-700">
                          {line.label}
                          <span className="ml-2 text-xs text-gray-400">
                            ({line.count})
                          </span>
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${
                            line.amountCents < 0
                              ? 'text-red-700'
                              : 'text-gray-900'
                          }`}
                        >
                          <Money cents={line.amountCents} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 text-sm">
                <span className="font-semibold text-gray-800">
                  {t('cf.subtotal', { activity: section.label })}
                </span>
                <span
                  className={`font-mono font-semibold ${
                    section.totalCents < 0
                      ? 'text-red-700'
                      : 'text-gray-900'
                  }`}
                >
                  <Money cents={section.totalCents} />
                </span>
              </div>
            </section>
          ))}
          <div className="flex items-center justify-between border-t-2 border-gray-300 bg-yge-blue-50 px-4 py-3 text-base">
            <span className="font-bold text-yge-blue-900">
              {t('cf.netChange')}
            </span>
            <span
              className={`font-mono font-bold ${
                stmt.netChangeCents < 0 ? 'text-red-700' : 'text-green-700'
              }`}
            >
              <Money cents={stmt.netChangeCents} />
            </span>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          {t('cf.disclaimer')}
        </p>
      </main>
    </AppShell>
  );
}
