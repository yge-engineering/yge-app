// /prompt-pay — CA §20104.50 / §10261.5 prompt-pay penalty interest report.
//
// Plain English: every public agency in California is supposed to pay
// an undisputed progress payment within 30 days. If they don't,
// statutory penalty interest accrues at 10% per annum (CCP §685.010(a))
// until paid. This page shows what we could legally demand right now
// if we wanted to push.

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import {
  buildPromptPayReport,
  type ArInvoice,
  type ArPayment,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

export default async function PromptPayPage({
  searchParams,
}: {
  searchParams: { asOf?: string };
}) {
  const asOf =
    searchParams.asOf?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ??
    new Date().toISOString().slice(0, 10);

  const [arInvoices, arPayments] = await Promise.all([
    fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    fetchJson<ArPayment>('/api/ar-payments', 'payments'),
  ]);

  const report = buildPromptPayReport({ asOf, arInvoices, arPayments });

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title="Prompt-pay interest"
          subtitle="CA Public Contract Code §20104.50 (local) and §10261.5 (state) require public agencies to pay an undisputed progress payment within 30 days. Otherwise: 10% per annum penalty interest (CCP §685.010(a))."
        />

        <form
          action="/prompt-pay"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3"
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">As-of date</span>
            <input
              name="asOf"
              type="date"
              defaultValue={asOf}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            Reload
          </button>
          <span className="text-xs text-gray-500">As of {asOf}.</span>
        </form>

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Tile
            label="Open invoices"
            value={report.rows.length}
            sublabel={`${report.overdueRows.length} past due`}
          />
          <Tile
            label="Penalty interest accrued"
            value={<Money cents={report.totalInterestCents} />}
            sublabel="What public agencies owe in late fees"
            tone={report.totalInterestCents > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="Total demand"
            value={<Money cents={report.totalDemandCents} />}
            sublabel="Unpaid principal + accrued interest"
          />
        </section>

        {report.rows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            No open AR invoices.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2 text-right">Days late</th>
                  <th className="px-3 py-2 text-right">Unpaid</th>
                  <th className="px-3 py-2 text-right">Penalty interest</th>
                  <th className="px-3 py-2 text-right">Total demand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.rows.map((r) => {
                  const overdue = r.daysLate > 0;
                  return (
                    <tr key={r.invoiceId} className={overdue ? 'bg-amber-50' : ''}>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.customerName}</td>
                      <td className="px-3 py-2 font-mono">
                        <Link
                          href={`/ar-invoices/${r.invoiceId}`}
                          className="text-blue-700 hover:underline"
                        >
                          {r.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {r.submittedOn}
                        {r.submittedOnSynthesized ? (
                          <span
                            className="ml-1 text-amber-700"
                            title="No sentAt on file — fell back to invoiceDate"
                          >
                            *
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.dueOn}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          r.daysLate > 90 ? 'font-bold text-red-700' : r.daysLate > 30 ? 'text-amber-700' : ''
                        }`}
                      >
                        {r.daysLate > 0 ? `${r.daysLate}d` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money cents={r.unpaidCents} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.interestCents > 0 ? (
                          <Money cents={r.interestCents} className="font-semibold text-amber-700" />
                        ) : (
                          <span className="font-mono text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money cents={r.totalDemandCents} className="font-semibold" />
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                  <td className="px-3 py-3 uppercase tracking-wide" colSpan={5}>Totals</td>
                  <td className="px-3 py-3 text-right">
                    <Money cents={report.totalUnpaidCents} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Money cents={report.totalInterestCents} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Money cents={report.totalDemandCents} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 max-w-3xl text-xs text-gray-500">
          * = sentAt missing from the invoice — submittedOn was synthesized from invoiceDate.
          Set sentAt on the invoice (the date the agency actually received it) for the accurate clock.
          <br />
          Retention release follows a different rule (PCC §7107: 60 days from completion notice,
          2% per month). The Retention page tracks that math separately.
        </p>
      </main>
    </AppShell>
  );
}
