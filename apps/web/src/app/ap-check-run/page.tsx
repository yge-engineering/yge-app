// /ap-check-run — next batch of AP invoices to cut checks for.

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import {
  buildApCheckRun,
  type ApInvoice,
  type ApPayment,
  type Vendor,
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

export default async function ApCheckRunPage({
  searchParams,
}: {
  searchParams: { asOf?: string };
}) {
  requirePermission('financials:edit');

  const asOf =
    typeof searchParams.asOf === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(searchParams.asOf)
      ? searchParams.asOf
      : new Date().toISOString().slice(0, 10);

  const [apInvoices, vendors] = await Promise.all([
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
    fetchJson<Vendor>('/api/vendors', 'vendors'),
  ]);

  const { rollup, rows, byVendor } = buildApCheckRun({
    apInvoices,
    vendors,
    asOf,
  });

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="AP check run"
          subtitle={`Approved + unpaid invoices grouped by vendor, sorted by urgency. As of ${asOf}.`}
        />

        <form
          action="/ap-check-run"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3"
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">As of</span>
            <input
              type="date"
              name="asOf"
              defaultValue={asOf}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
          >
            Refresh
          </button>
          <span className="ml-auto text-xs text-gray-600">
            {byVendor.length} vendor
            {byVendor.length === 1 ? '' : 's'} · {rollup.totalInvoices} invoice
            {rollup.totalInvoices === 1 ? '' : 's'} · total{' '}
            <Money cents={rollup.totalUnpaidCents} />
            {' · overdue '}
            <Money cents={rollup.overdueCents} />
          </span>
        </form>

        {byVendor.length === 0 ? (
          <p className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            No approved + unpaid invoices. Check run is empty. ✓
          </p>
        ) : (
          <div className="space-y-4">
            {byVendor.map((v) => {
              const vendorRows = rows.filter(
                (r) =>
                  (v.vendorId
                    ? r.vendorId === v.vendorId
                    : r.vendorName === v.vendorName) &&
                  r.vendorName === v.vendorName,
              );
              return (
              <section
                key={v.vendorId ?? v.vendorName}
                className="rounded-md border border-gray-200 bg-white"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gray-100 px-4 py-2">
                  <h2 className="font-semibold text-gray-900">
                    {v.vendorName}
                    {v.vendorId ? (
                      <Link
                        href={`/vendors/${v.vendorId}`}
                        className="ml-2 text-xs text-yge-blue-700 hover:underline"
                      >
                        view vendor →
                      </Link>
                    ) : null}
                  </h2>
                  <div className="text-xs text-gray-700">
                    {v.invoiceCount} invoice
                    {v.invoiceCount === 1 ? '' : 's'} · due{' '}
                    <Money cents={v.unpaidTotalCents} />
                    {v.hasOverdue ? (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800">
                        Has overdue
                      </span>
                    ) : null}
                    {v.vendorOnHold ? (
                      <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-700">
                        On hold
                      </span>
                    ) : null}
                  </div>
                </header>
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-3 py-1">Invoice #</th>
                      <th className="px-3 py-1">Invoice date</th>
                      <th className="px-3 py-1">Due date</th>
                      <th className="px-3 py-1 text-right">Unpaid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vendorRows.map((r) => (
                      <tr key={r.invoiceId}>
                        <td className="px-3 py-1 font-mono text-xs">
                          <Link
                            href={`/ap-invoices/${r.invoiceId}`}
                            className="text-yge-blue-700 hover:underline"
                          >
                            {r.invoiceNumber ?? r.invoiceId.slice(-6)}
                          </Link>
                        </td>
                        <td className="px-3 py-1 font-mono text-xs">
                          {r.invoiceDate}
                        </td>
                        <td className="px-3 py-1 font-mono text-xs">
                          {r.dueDate ?? '—'}
                        </td>
                        <td className="px-3 py-1 text-right font-mono font-semibold">
                          <Money cents={r.unpaidCents} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          This is the worksheet — print or screenshot it for Brook's
          check-cutting session. Marking invoices paid happens through
          /ap-invoices/[id] individually so the audit trail stays clean.
        </p>
      </main>
    </AppShell>
  );
}
