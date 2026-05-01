// /prompt-pay — CA §20104.50 / §10261.5 prompt-pay penalty interest report.
//
// Plain English: every public agency in California is supposed to pay an
// undisputed progress payment within 30 days. If they don't, statutory
// penalty interest accrues at 10% per annum (CCP §685.010(a)) until paid.
// This page shows what we could legally demand right now if we wanted to
// push.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  buildPromptPayReport,
  formatUSD,
  type ArInvoice,
  type ArPayment,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const body = (await res.json()) as Record<string, unknown>;
  const arr = body[key];
  return Array.isArray(arr) ? (arr as T[]) : [];
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
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">
        Prompt-Pay Interest
      </h1>
      <p className="mt-2 max-w-3xl text-gray-700">
        California Public Contract Code §20104.50 (local agencies) and
        §10261.5 (state agencies) require public agencies to pay an
        undisputed progress payment within 30 days. If they don&rsquo;t,
        the contractor is owed penalty interest at 10% per annum (Code of
        Civil Procedure §685.010(a)) until paid. This is the dollar amount
        we could legally demand right now.
      </p>

      <form
        action="/prompt-pay"
        className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
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
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Reload
        </button>
        <span className="text-xs text-gray-500">As of {asOf}.</span>
      </form>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Open invoices"
          value={String(report.rows.length)}
          sub={`${report.overdueRows.length} past due`}
        />
        <Stat
          label="Penalty interest accrued"
          value={formatUSD(report.totalInterestCents)}
          variant={report.totalInterestCents > 0 ? 'warn' : 'ok'}
          sub="What public agencies owe in late fees"
        />
        <Stat
          label="Total demand"
          value={formatUSD(report.totalDemandCents)}
          sub="Unpaid principal + accrued interest"
        />
      </section>

      {report.rows.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No open AR invoices.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
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
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.customerName}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      <Link
                        href={`/ar-invoices/${r.invoiceId}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        {r.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {r.submittedOn}
                      {r.submittedOnSynthesized && (
                        <span
                          className="ml-1 text-amber-700"
                          title="No sentAt on file — fell back to invoiceDate"
                        >
                          *
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.dueOn}</td>
                    <td
                      className={`px-3 py-2 text-right font-mono ${
                        r.daysLate > 90
                          ? 'font-bold text-red-700'
                          : r.daysLate > 30
                            ? 'text-amber-700'
                            : ''
                      }`}
                    >
                      {r.daysLate > 0 ? `${r.daysLate}d` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUSD(r.unpaidCents)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono ${
                        overdue ? 'font-semibold text-amber-700' : 'text-gray-400'
                      }`}
                    >
                      {r.interestCents > 0 ? formatUSD(r.interestCents) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {formatUSD(r.totalDemandCents)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                <td className="px-3 py-3 uppercase tracking-wide" colSpan={5}>
                  Totals
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatUSD(report.totalUnpaidCents)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatUSD(report.totalInterestCents)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatUSD(report.totalDemandCents)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 max-w-3xl text-xs text-gray-500">
        * = sentAt missing from the invoice — submittedOn was synthesized
        from invoiceDate. Set sentAt on the invoice (the date the agency
        actually received it) for the accurate clock.
        <br />
        Retention release follows a different rule (PCC §7107: 60 days
        from completion notice, 2% per month). The Retention page tracks
        that math separately.
      </p>
    </main>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  sub,
  variant = 'ok',
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: 'ok' | 'warn' | 'bad';
}) {
  const valueClass =
    variant === 'bad'
      ? 'text-red-700'
      : variant === 'warn'
        ? 'text-amber-700'
        : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</div>
      {sub != null && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
