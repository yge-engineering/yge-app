// /1099-worksheet — year-end 1099-NEC worksheet for the CPA.
//
// Plain English: every January, Brook ships a 1099 packet to the CPA.
// This page is the worksheet — every non-corp vendor paid >= $600
// for the year, sorted biggest first, with red badges where a current
// W-9 or a TIN is missing (the IRS blocker).

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import { StatementCsvButton } from '../../components/statement-csv-button';
import { PrintButton } from '../../components/print-button';
import {
  buildVendor1099Report,
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

export default async function Tax1099WorksheetPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  requirePermission('financials:view');

  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const parsedYear = Number.parseInt(searchParams.year ?? '', 10);
  const year =
    Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : defaultYear;

  const [vendors, payments] = await Promise.all([
    fetchJson<Vendor>('/api/vendors', 'vendors'),
    fetchJson<ApPayment>('/api/ap-payments', 'payments'),
  ]);

  const report = buildVendor1099Report({
    year,
    vendors,
    payments,
    asOf: now,
  });

  const nineNineHeaders = ['Vendor', 'Paid YTD', 'Payments', 'Over $600', 'Missing W-9', 'Missing TIN'];
  const d99 = (c: number) => (c / 100).toFixed(2);
  const nineNineRows: Array<Array<string | number>> = report.rows.map((r) => [
    r.vendorName,
    d99(r.paidYtdCents),
    r.paymentCount,
    r.overThreshold ? 'Y' : 'N',
    r.missingCurrentW9 ? 'Y' : 'N',
    r.missingTaxId ? 'Y' : 'N',
  ]);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title={`1099-NEC worksheet — ${year}`}
          subtitle="Non-corp vendors paid this year, biggest first. Red badges = IRS-blocker (no W-9 or no TIN)."
        />

        <div className="mb-4 flex justify-end gap-2 print:hidden">
          <PrintButton />
          <StatementCsvButton filename={`1099-worksheet_${year}.csv`} headers={nineNineHeaders} rows={nineNineRows} />
        </div>

        <form
          action="/1099-worksheet"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3 print:hidden"
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Tax year</span>
            <input
              type="number"
              name="year"
              min={2000}
              max={2100}
              defaultValue={year}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
          >
            Refresh
          </button>
          <span className="ml-auto text-xs text-gray-600">
            Threshold: <Money cents={report.thresholdCents} /> /yr
          </span>
        </form>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Reportable vendors
            </div>
            <div className="mt-1 text-2xl font-bold text-yge-blue-900">
              {report.reportableCount}
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Total reportable
            </div>
            <div className="mt-1 text-2xl font-bold text-yge-blue-900">
              <Money cents={report.totalReportableCents} />
            </div>
          </div>
          <div
            className={`rounded-md border p-3 ${
              report.missingW9Count > 0
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Missing W-9 (blockers)
            </div>
            <div
              className={`mt-1 text-2xl font-bold ${
                report.missingW9Count > 0 ? 'text-red-700' : 'text-yge-blue-900'
              }`}
            >
              {report.missingW9Count}
            </div>
          </div>
        </div>

        {report.rows.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No AP payments in {year}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2 text-right">YTD paid</th>
                  <th className="px-3 py-2 text-right"># pmts</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.rows.map((r) => {
                  const isBlocker =
                    r.is1099Reportable &&
                    r.overThreshold &&
                    (r.missingCurrentW9 || r.missingTaxId);
                  return (
                    <tr
                      key={r.vendorId ?? r.vendorName}
                      className={isBlocker ? 'bg-red-50' : ''}
                    >
                      <td className="px-3 py-1.5">
                        {r.vendorId ? (
                          <Link
                            href={`/vendors/${r.vendorId}`}
                            className="text-yge-blue-700 hover:underline"
                          >
                            {r.vendorName}
                          </Link>
                        ) : (
                          <span className="text-gray-800">{r.vendorName}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">
                        <Money cents={r.paidYtdCents} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs text-gray-600">
                        {r.paymentCount}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {r.is1099Reportable ? (
                            <span className="rounded bg-yge-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-yge-blue-800">
                              1099-NEC
                            </span>
                          ) : (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                              Corp / exempt
                            </span>
                          )}
                          {r.overThreshold ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                              Over $600
                            </span>
                          ) : null}
                          {r.missingCurrentW9 ? (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800">
                              No W-9
                            </span>
                          ) : null}
                          {r.missingTaxId ? (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800">
                              No TIN
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          Worksheet only — actual 1099-NEC filing happens through the CPA
          or the IRS FIRE system. Use the badges above to chase missing
          W-9s in December before the January 31 filing deadline.
        </p>
      </main>
    </AppShell>
  );
}
