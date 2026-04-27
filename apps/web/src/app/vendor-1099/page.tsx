// /vendor-1099 — year-end 1099-NEC reporting roll-up.

import Link from 'next/link';
import {
  buildVendor1099Report,
  formatUSD,
  type ApPayment,
  type Vendor,
  type Vendor1099Row,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchVendors(): Promise<Vendor[]> {
  const res = await fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { vendors: Vendor[] }).vendors;
}
async function fetchApPayments(): Promise<ApPayment[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ap-payments`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { payments: ApPayment[] }).payments;
}

export default async function Vendor1099Page({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const year = /^\d{4}$/.test(searchParams.year ?? '')
    ? Number(searchParams.year)
    : new Date().getFullYear();

  const [vendors, payments] = await Promise.all([fetchVendors(), fetchApPayments()]);
  const report = buildVendor1099Report({ year, vendors, payments });

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">1099-NEC Year-end</h1>
      <p className="mt-2 text-gray-700">
        For each 1099-reportable vendor paid &ge; ${(report.thresholdCents / 100).toFixed(0)}
        {' '}in calendar year {report.year}, sums YTD payments and flags
        anyone missing a current W-9 — the IRS wants the EIN/SSN on the
        1099 form before the bookkeeper can file in January.
      </p>

      <form action="/vendor-1099" className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">Year</span>
          <input
            type="number"
            name="year"
            defaultValue={year}
            min="2000"
            max="2100"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Reload
        </button>
      </form>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Vendors paid" value={report.rows.length} />
        <Stat
          label="1099-reportable (over $)"
          value={report.reportableCount}
        />
        <Stat
          label="Total reportable $"
          value={formatUSD(report.totalReportableCents)}
        />
        <Stat
          label="Missing W-9 (blocker)"
          value={report.missingW9Count}
          variant={report.missingW9Count > 0 ? 'bad' : 'ok'}
        />
      </section>

      {report.missingW9Count > 0 && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>{report.missingW9Count} vendor{report.missingW9Count === 1 ? '' : 's'} blocked from 1099 filing</strong>{' '}
          — over the $600 threshold, marked 1099-reportable, but with no
          current W-9 on file. Collect the W-9 before the bookkeeper files.
        </div>
      )}

      {report.rows.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No vendor payments in {report.year}.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2 text-right">Payments</th>
                <th className="px-4 py-2 text-right">Paid YTD</th>
                <th className="px-4 py-2">1099?</th>
                <th className="px-4 py-2">W-9</th>
                <th className="px-4 py-2">Tax ID</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.rows.map((r) => (
                <Row key={`${r.vendorId ?? r.vendorName}`} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Row({ row }: { row: Vendor1099Row }) {
  const blocking = row.missingCurrentW9 || row.missingTaxId;
  const cls = blocking
    ? 'bg-red-50'
    : row.is1099Reportable && row.overThreshold
      ? 'bg-blue-50'
      : '';
  return (
    <tr className={cls}>
      <td className="px-4 py-3 text-sm">
        <div className="font-medium text-gray-900">{row.vendorName}</div>
        {row.vendorId == null && (
          <div className="text-[10px] italic text-yellow-700">
            Not in vendor master — name may have drifted. Add to vendor list to enable W-9 tracking.
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
        {row.paymentCount}
      </td>
      <td
        className={`px-4 py-3 text-right font-mono text-sm ${
          row.overThreshold ? 'font-semibold' : ''
        }`}
      >
        {formatUSD(row.paidYtdCents)}
      </td>
      <td className="px-4 py-3 text-xs">
        {row.is1099Reportable ? (
          row.overThreshold ? (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-800">
              FILE
            </span>
          ) : (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-700">
              Under $
            </span>
          )
        ) : (
          <span className="text-gray-400">N/A</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {row.missingCurrentW9 ? (
          <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800">
            MISSING
          </span>
        ) : row.is1099Reportable ? (
          <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800">
            On file
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {row.missingTaxId ? (
          <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800">
            MISSING
          </span>
        ) : row.is1099Reportable && row.overThreshold ? (
          <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800">
            On file
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        {row.vendorId && (
          <Link href={`/vendors/${row.vendorId}`} className="text-yge-blue-500 hover:underline">
            Open
          </Link>
        )}
      </td>
    </tr>
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
