// /vendor-1099 — year-end 1099-NEC reporting roll-up.
//
// Plain English: for each 1099-reportable vendor paid ≥ $600 in
// calendar year, sums YTD payments and flags anyone missing a current
// W-9 — the IRS wants the EIN/SSN on the 1099 form before the
// bookkeeper can file in January.

import Link from 'next/link';

import {
  AppShell,
  Card,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import {
  buildVendor1099Report,
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
  try {
    const res = await fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { vendors: Vendor[] }).vendors;
  } catch {
    return [];
  }
}
async function fetchApPayments(): Promise<ApPayment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ap-payments`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ApPayment[] }).payments;
  } catch {
    return [];
  }
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
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="1099-NEC year-end"
          subtitle={`For each 1099-reportable vendor paid ≥ $${(report.thresholdCents / 100).toFixed(0)} in ${report.year}, sums YTD payments and flags anyone missing a current W-9 — the IRS wants the EIN/SSN before filing in January.`}
        />

        <form action="/vendor-1099" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
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
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            Reload
          </button>
        </form>

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Vendors paid" value={report.rows.length} />
          <Tile label="1099-reportable (over $)" value={report.reportableCount} />
          <Tile label="Total reportable $" value={<Money cents={report.totalReportableCents} />} />
          <Tile
            label="Missing W-9 (blocker)"
            value={report.missingW9Count}
            tone={report.missingW9Count > 0 ? 'danger' : 'success'}
          />
        </section>

        {report.missingW9Count > 0 ? (
          <Card className="mb-4 border-red-300 bg-red-50">
            <p className="text-sm text-red-900">
              <strong>{report.missingW9Count} vendor{report.missingW9Count === 1 ? '' : 's'} blocked from 1099 filing</strong>{' '}
              — over the ${(report.thresholdCents / 100).toFixed(0)} threshold, marked 1099-reportable, but with no
              current W-9 on file. Collect the W-9 before the bookkeeper files.
            </p>
          </Card>
        ) : null}

        {report.rows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            No vendor payments in {report.year}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
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
    </AppShell>
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
        {row.vendorId == null ? (
          <div className="text-[10px] italic text-amber-700">
            Not in vendor master — name may have drifted. Add to vendor list to enable W-9 tracking.
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">{row.paymentCount}</td>
      <td className={`px-4 py-3 text-right ${row.overThreshold ? 'font-semibold' : ''}`}>
        <Money cents={row.paidYtdCents} />
      </td>
      <td className="px-4 py-3">
        {row.is1099Reportable
          ? row.overThreshold
            ? <StatusPill label="FILE" tone="info" />
            : <StatusPill label="Under $" tone="muted" />
          : <span className="text-xs text-gray-400">N/A</span>}
      </td>
      <td className="px-4 py-3">
        {row.missingCurrentW9
          ? <StatusPill label="MISSING" tone="danger" />
          : row.is1099Reportable
            ? <StatusPill label="On file" tone="success" />
            : <span className="text-xs text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3">
        {row.missingTaxId
          ? <StatusPill label="MISSING" tone="danger" />
          : row.is1099Reportable && row.overThreshold
            ? <StatusPill label="On file" tone="success" />
            : <span className="text-xs text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        {row.vendorId ? (
          <Link href={`/vendors/${row.vendorId}`} className="text-blue-700 hover:underline">
            Open
          </Link>
        ) : null}
      </td>
    </tr>
  );
}
