// /ar-payments — money received from customers + agencies.
//
// Plain English: receipts applied to AR invoices. Retention releases
// tracked separately for CA Public Contract Code §7107 prompt-pay
// interest. The blue-tinted RETENTION_RELEASE rows let bookkeeping
// see the §7107 clock at a glance.

import Link from 'next/link';

import {
  AppShell,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import {
  arPaymentKindLabel,
  arPaymentMethodLabel,
  computeArPaymentRollup,
  type ArPayment,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchPayments(filter: {
  arInvoiceId?: string;
  jobId?: string;
}): Promise<ArPayment[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/ar-payments`);
    if (filter.arInvoiceId) url.searchParams.set('arInvoiceId', filter.arInvoiceId);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ArPayment[] }).payments;
  } catch { return []; }
}

export default async function ArPaymentsPage({
  searchParams,
}: {
  searchParams: { arInvoiceId?: string; jobId?: string };
}) {
  const payments = await fetchPayments(searchParams);
  const rollup = computeArPaymentRollup(payments);

  const csvHref = `${publicApiBaseUrl()}/api/ar-payments?format=csv${
    searchParams.arInvoiceId ? '&arInvoiceId=' + encodeURIComponent(searchParams.arInvoiceId) : ''
  }${searchParams.jobId ? '&jobId=' + encodeURIComponent(searchParams.jobId) : ''}`;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Customer payments"
          subtitle="Money in. Receipts applied to AR invoices. Retention releases tracked for CA Public Contract Code §7107 prompt-pay interest."
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Download CSV
              </a>
              <LinkButton href="/ar-payments/new" variant="primary" size="md">
                + Record payment
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Tile label="Receipts" value={rollup.total} />
          <Tile label="Total received" value={<Money cents={rollup.totalCents} />} />
          <Tile
            label="Retention released"
            value={
              <>
                {rollup.retentionReleaseCount} / <Money cents={rollup.retentionReleaseCents} />
              </>
            }
          />
        </section>

        {payments.length === 0 ? (
          <EmptyState
            title="No payments yet"
            body="Record each receipt against the AR invoice it applies to. Mark a receipt as a retention release to start the §7107 clock."
            actions={[{ href: '/ar-payments/new', label: 'Record payment', primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
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
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      <Link href={`/ar-payments/${p.id}`} className="text-blue-700 hover:underline">{p.receivedOn}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={arPaymentKindLabel(p.kind)}
                        tone={p.kind === 'RETENTION_RELEASE' ? 'info' : 'neutral'}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{arPaymentMethodLabel(p.method)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {p.referenceNumber || <span className="text-gray-400 font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money cents={p.amountCents} className="font-semibold" />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Link href={`/ar-invoices/${p.arInvoiceId}`} className="text-blue-700 hover:underline">
                        {p.arInvoiceId}
                      </Link>
                    </td>
                    <td className="px-4 py-3"></td>
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
