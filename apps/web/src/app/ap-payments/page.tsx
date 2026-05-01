// /ap-payments — outgoing payment register (the "check register").
//
// Plain English: money out to vendors against AP invoices. Sorted
// newest-first; uncleared rows are highlighted because they're funds
// in transit. Bank-rec depends on the cleared-flag here.

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
  apPaymentMethodLabel,
  computeApPaymentRollup,
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
  try {
    const url = new URL(`${apiBaseUrl()}/api/ap-payments`);
    if (filter.method) url.searchParams.set('method', filter.method);
    if (filter.apInvoiceId) url.searchParams.set('apInvoiceId', filter.apInvoiceId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ApPayment[] }).payments;
  } catch { return []; }
}
async function fetchAll(): Promise<ApPayment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ap-payments`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ApPayment[] }).payments;
  } catch { return []; }
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

  const csvHref = `${publicApiBaseUrl()}/api/ap-payments?format=csv${
    searchParams.method ? '&method=' + encodeURIComponent(searchParams.method) : ''
  }`;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Check register"
          subtitle="Money out to vendors against AP invoices. Sorted newest-first; uncleared rows are highlighted because they're funds in transit."
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Download CSV
              </a>
              <LinkButton href="/ap-payments/new" variant="primary" size="md">
                + Record payment
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Payments" value={rollup.total} />
          <Tile label="Total paid (lifetime)" value={<Money cents={rollup.totalCents} />} />
          <Tile
            label="Uncleared"
            value={
              <>
                {rollup.uncleared} · <Money cents={rollup.unclearedCents} />
              </>
            }
            tone={rollup.uncleared > 0 ? 'warn' : 'success'}
          />
          <Tile label="Voided" value={rollup.voided} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Method:</span>
          <Link
            href={buildHref({ method: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.method ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {METHODS.map((m) => (
            <Link
              key={m}
              href={buildHref({ method: m })}
              className={`rounded px-2 py-1 text-xs ${searchParams.method === m ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {apPaymentMethodLabel(m)}
            </Link>
          ))}
        </section>

        {payments.length === 0 ? (
          <EmptyState
            title="No payments in this filter"
            body="The check register fills up as you cut checks / send ACH / pay cards. Bank rec sets the cleared flag automatically once the payment matches a statement line."
            actions={[{ href: '/ap-payments/new', label: 'Record payment', primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
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
                          ? 'bg-amber-50'
                          : ''
                    }
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      <Link href={`/ap-payments/${p.id}`} className="text-blue-700 hover:underline">{p.paidOn}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{p.vendorName}</div>
                      <div className="text-[10px] font-mono text-gray-500">{p.apInvoiceId}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{apPaymentMethodLabel(p.method)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.referenceNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{p.bankAccount ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Money cents={p.amountCents} className="font-semibold" />
                    </td>
                    <td className="px-4 py-3">
                      {p.voided
                        ? <StatusPill label="Voided" tone="muted" />
                        : p.cleared
                          ? <StatusPill label="Cleared" tone="success" />
                          : <StatusPill label="In transit" tone="warn" />}
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
