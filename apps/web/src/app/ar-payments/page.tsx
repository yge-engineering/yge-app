// /ar-payments — money received from customers + agencies.

import Link from 'next/link';
import {
  arPaymentKindLabel,
  arPaymentMethodLabel,
  computeArPaymentRollup,
  formatUSD,
  type ArPayment,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPayments(filter: {
  arInvoiceId?: string;
  jobId?: string;
}): Promise<ArPayment[]> {
  const url = new URL(`${apiBaseUrl()}/api/ar-payments`);
  if (filter.arInvoiceId) url.searchParams.set('arInvoiceId', filter.arInvoiceId);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { payments: ArPayment[] }).payments;
}

export default async function ArPaymentsPage({
  searchParams,
}: {
  searchParams: { arInvoiceId?: string; jobId?: string };
}) {
  const payments = await fetchPayments(searchParams);
  const rollup = computeArPaymentRollup(payments);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/ar-payments/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + Record payment
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Customer Payments</h1>
      <p className="mt-2 text-gray-700">
        Money in. Receipts applied to AR invoices. Retention releases tracked
        for CA Public Contract Code §7107 prompt-pay interest.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Receipts" value={rollup.total} />
        <Stat label="Total received" value={formatUSD(rollup.totalCents)} />
        <Stat
          label="Retention released"
          value={`${rollup.retentionReleaseCount} / ${formatUSD(rollup.retentionReleaseCents)}`}
        />
      </section>

      {payments.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No payments yet. Click <em>Record payment</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Received</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id} className={p.kind === 'RETENTION_RELEASE' ? 'bg-blue-50' : ''}>
                  <td className="px-4 py-3 text-xs text-gray-700">{p.receivedOn}</td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 font-semibold ${
                        p.kind === 'RETENTION_RELEASE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {arPaymentKindLabel(p.kind)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {arPaymentMethodLabel(p.method)}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-700">
                    {p.referenceNumber || <span className="text-gray-400 font-sans">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                    {formatUSD(p.amountCents)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Link
                      href={`/ar-invoices/${p.arInvoiceId}`}
                      className="text-yge-blue-500 hover:underline"
                    >
                      {p.arInvoiceId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link href={`/ar-payments/${p.id}`} className="text-yge-blue-500 hover:underline">
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
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
