// /customer-concentration — revenue concentration analysis.

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import {
  buildCustomerConcentration,
  customerDisplayName,
  type ArInvoice,
  type Customer,
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

export default async function CustomerConcentrationPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  requirePermission('financials:view');

  const now = new Date();
  const def = ytdRange(now);
  const start = isIsoDate(searchParams.start) ? searchParams.start : def.start;
  const end = isIsoDate(searchParams.end) ? searchParams.end : def.end;

  const [arInvoices, customers] = await Promise.all([
    fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    fetchJson<Customer>('/api/customers', 'customers'),
  ]);

  const report = buildCustomerConcentration({ start, end, arInvoices });

  // Best-effort link of customer name → master id. Try legalName + dbaName.
  const customerIdByName = new Map<string, string>();
  for (const c of customers) {
    const legal = c.legalName.toLowerCase().trim();
    if (legal && !customerIdByName.has(legal)) customerIdByName.set(legal, c.id);
    if (c.dbaName) {
      const dba = c.dbaName.toLowerCase().trim();
      if (dba && !customerIdByName.has(dba)) customerIdByName.set(dba, c.id);
    }
    const disp = customerDisplayName(c).toLowerCase().trim();
    if (disp && !customerIdByName.has(disp)) customerIdByName.set(disp, c.id);
  }

  const top1Pct = report.top1SharePct * 100;
  const top1Color =
    top1Pct >= 50
      ? 'border-red-300 bg-red-50 text-red-800'
      : top1Pct >= 30
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-gray-200 bg-white text-gray-800';

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Customer concentration"
          subtitle={`AR invoices ${start} to ${end} grouped by customer. DRAFT and WRITTEN_OFF skipped.`}
        />

        <form
          action="/customer-concentration"
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
        </form>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Total billed
            </div>
            <div className="mt-1 text-xl font-bold text-yge-blue-900">
              <Money cents={report.totalBilledCents} />
            </div>
          </div>
          <div className={`rounded-md border p-3 ${top1Color}`}>
            <div className="text-[11px] uppercase tracking-wide">
              Top-1 share
            </div>
            <div className="mt-1 text-xl font-bold">{top1Pct.toFixed(0)}%</div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Top-5 share
            </div>
            <div className="mt-1 text-xl font-bold text-yge-blue-900">
              {(report.top5SharePct * 100).toFixed(0)}%
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              HHI
            </div>
            <div className="mt-1 text-xl font-bold text-yge-blue-900">
              {Math.round(report.hhi).toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-500">
              {report.hhi >= 2500
                ? 'highly concentrated'
                : report.hhi >= 1500
                  ? 'moderate'
                  : 'diffuse'}
            </div>
          </div>
        </div>

        {report.rows.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No AR invoices in this date range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2 text-right">Invoices</th>
                  <th className="px-3 py-2 text-right">Jobs</th>
                  <th className="px-3 py-2 text-right">Billed</th>
                  <th className="px-3 py-2 text-right">Collected</th>
                  <th className="px-3 py-2 text-right">% of period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.rows.map((r, i) => {
                  const cid =
                    customerIdByName.get(r.customerName.toLowerCase().trim()) ??
                    null;
                  return (
                    <tr key={`${r.customerName}-${i}`}>
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-500">
                        {i + 1}
                      </td>
                      <td className="px-3 py-1.5">
                        {cid ? (
                          <Link
                            href={`/customers/${cid}`}
                            className="text-yge-blue-700 hover:underline"
                          >
                            {r.customerName}
                          </Link>
                        ) : (
                          <span className="text-gray-800">{r.customerName}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs">
                        {r.invoiceCount}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs">
                        {r.jobCount}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">
                        <Money cents={r.billedCents} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-green-700">
                        <Money cents={r.collectedCents} />
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
          HHI: sum of squared market shares × 10,000. Above 2,500 = highly
          concentrated (bonding underwriters get nervous); below 1,500 =
          diffuse and resilient.
        </p>
      </main>
    </AppShell>
  );
}
