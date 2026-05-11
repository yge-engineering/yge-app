// /vendor-spend — vendor concentration + total spend by date range.

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import {
  buildVendorSpendReport,
  type ApInvoice,
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

function ytdRange(now: Date): { start: string; end: string } {
  const year = now.getUTCFullYear();
  return { start: `${year}-01-01`, end: now.toISOString().slice(0, 10) };
}

function isIsoDate(s: string | undefined): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function VendorSpendPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  requirePermission('financials:view');

  const now = new Date();
  const def = ytdRange(now);
  const start = isIsoDate(searchParams.start) ? searchParams.start : def.start;
  const end = isIsoDate(searchParams.end) ? searchParams.end : def.end;

  const [apInvoices, vendors] = await Promise.all([
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
    fetchJson<Vendor>('/api/vendors', 'vendors'),
  ]);

  const report = buildVendorSpendReport({ start, end, apInvoices });

  // Resolve vendorId via name match against the master list so we
  // can deep-link rows where possible.
  const vendorIdByName = new Map<string, string>();
  for (const v of vendors) {
    const k = v.legalName.toLowerCase().trim();
    if (!vendorIdByName.has(k)) vendorIdByName.set(k, v.id);
    if (v.dbaName) {
      const k2 = v.dbaName.toLowerCase().trim();
      if (!vendorIdByName.has(k2)) vendorIdByName.set(k2, v.id);
    }
  }

  const concentrationColor =
    report.top5SharePct >= 0.8
      ? 'border-red-300 bg-red-50 text-red-800'
      : report.top5SharePct >= 0.6
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-gray-200 bg-white text-gray-800';

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Vendor spend"
          subtitle={`AP invoices ${start} to ${end} grouped by vendor. APPROVED / PENDING / PAID counted; DRAFT and REJECTED skipped.`}
        />

        <form
          action="/vendor-spend"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3"
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">From</span>
            <input
              type="date"
              name="start"
              defaultValue={start}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">To</span>
            <input
              type="date"
              name="end"
              defaultValue={end}
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
            {report.vendorCount} vendor{report.vendorCount === 1 ? '' : 's'}
          </span>
        </form>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Total spend
            </div>
            <div className="mt-1 text-xl font-bold text-yge-blue-900">
              <Money cents={report.totalSpendCents} />
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Paid
            </div>
            <div className="mt-1 text-xl font-bold text-green-700">
              <Money cents={report.totalPaidCents} />
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Outstanding
            </div>
            <div className="mt-1 text-xl font-bold text-amber-700">
              <Money cents={report.totalOutstandingCents} />
            </div>
          </div>
          <div className={`rounded-md border p-3 ${concentrationColor}`}>
            <div className="text-[11px] uppercase tracking-wide">
              Top-5 concentration
            </div>
            <div className="mt-1 text-xl font-bold">
              {(report.top5SharePct * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {report.rows.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No AP invoices in this date range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2 text-right">Invoices</th>
                  <th className="px-3 py-2 text-right">Total spend</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2 text-right">% of period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.rows.map((r, i) => {
                  const vendorId =
                    vendorIdByName.get(r.vendorName.toLowerCase().trim()) ??
                    null;
                  return (
                    <tr key={`${r.vendorName}-${i}`}>
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-500">
                        {i + 1}
                      </td>
                      <td className="px-3 py-1.5">
                        {vendorId ? (
                          <Link
                            href={`/vendors/${vendorId}`}
                            className="text-yge-blue-700 hover:underline"
                          >
                            {r.vendorName}
                          </Link>
                        ) : (
                          <span className="text-gray-800">{r.vendorName}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs">
                        {r.invoiceCount}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">
                        <Money cents={r.totalSpendCents} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-green-700">
                        <Money cents={r.totalPaidCents} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-amber-700">
                        <Money cents={r.outstandingCents} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs text-gray-600">
                        {(r.shareOfPeriod * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          Concentration above 60% across the top-5 vendors is a supply-chain
          risk signal — diversify before the next price hike forces it.
        </p>
      </main>
    </AppShell>
  );
}
