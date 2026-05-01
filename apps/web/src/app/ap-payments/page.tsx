// /ap-payments — outgoing payment register (the "check register").

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  apPaymentMethodLabel,
  computeApPaymentRollup,
  formatUSD,
  type ApPayment,
  type ApPaymentMethod,
} from '@yge/shared';

const METHODS: ApPaymentMethod[] = ['CHECK', 'ACH', 'WIRE', 'CREDIT_CARD', 'CASH', 'OTHER'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchPayments(filter: { method?: string; apInvoiceId?: string }): Promise<ApPayment[]> {
  const url = new URL(`${apiBaseUrl()}/api/ap-payments`);
  if (filter.method) url.searchParams.set('method', filter.method);
  if (filter.apInvoiceId) url.searchParams.set('apInvoiceId', filter.apInvoiceId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { payments: ApPayment[] }).payments;
}
async function fetchAll(): Promise<ApPayment[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ap-payments`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { payments: ApPayment[] }).payments;
}

export default async function ApPaymentsPage({
  searchParams,
}: {
  searchParams: { method?: string; apInvoiceId?: string };
}) {
  const [payments, all] = await Promise.all([fetchPayments(searchParams), fetchAll()]);
  const rollup = computeApPaymentRollup(all);

  function buildHref(overrides: Partial<{ method?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.method) params.set('method', merged.method);
    if (merged.apInvoiceId) params.set('apInvoiceId', merged.apInvoiceId);
    const q = params.toString();
    return q ? `/ap-payments?${q}` : '/ap-payments';
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`${publicApiBaseUrl()}/api/ap-payments?format=csv${searchParams.method ? '&method=' + encodeURIComponent(searchParams.method) : ''}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Download CSV
          </a>
          <Link
            href="/ap-payments/new"
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + Record payment
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Check Register</h1>
      <p className="mt-2 text-gray-700">
        Money out to vendors against AP invoices. Sorted newest-first; uncleared
        rows are highlighted because they're funds in transit.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Payments" value={rollup.total} />
        <Stat label="Total paid (lifetime)" value={formatUSD(rollup.totalCents)} />
        <Stat
          label="Uncleared"
          value={`${rollup.uncleared} · ${formatUSD(rollup.unclearedCents)}`}
          variant={rollup.uncleared > 0 ? 'warn' : 'ok'}
        />
        <Stat label="Voided" value={rollup.voided} />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Method:</span>
        <Link
          href={buildHref({ method: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.method ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {METHODS.map((m) => (
          <Link
            key={m}
            href={buildHref({ method: m })}
            className={`rounded px-2 py-1 text-xs ${searchParams.method === m ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {apPaymentMethodLabel(m)}
          </Link>
        ))}
      </section>

      {payments.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No payments in this filter. Click <em>Record payment</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Paid</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">Bank</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className={
                    p.voided
                      ? 'bg-gray-50 text-gray-400 line-through'
                      : !p.cleared
                        ? 'bg-yellow-50'
                        : ''
                  }
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {p.paidOn}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="font-medium">{p.vendorName}</div>
                    <div className="text-[10px] font-mono text-gray-500">
                      {p.apInvoiceId}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {apPaymentMethodLabel(p.method)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {p.referenceNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {p.bankAccount ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                    {formatUSD(p.amountCents)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.voided ? (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 font-semibold text-gray-700">
                        Voided
                      </span>
                    ) : p.cleared ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800">
                        Cleared
                      </span>
                    ) : (
                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 font-semibold text-yellow-800">
                        In transit
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link href={`/ap-payments/${p.id}`} className="text-yge-blue-500 hover:underline">
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
