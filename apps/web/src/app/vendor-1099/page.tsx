// /vendor-1099 — year-end 1099-NEC reporting roll-up.
//
// Plain English: for each 1099-reportable vendor paid ≥ $600 in
// calendar year, sums YTD payments and flags anyone missing a current
// W-9 — the IRS wants the EIN/SSN on the 1099 form before the
// bookkeeper can file in January.

import Link from 'next/link';

import {
  Alert,
  AppShell,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
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
  const t = getTranslator();
  const thresholdDollars = (report.thresholdCents / 100).toFixed(0);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('v1099.title')}
          subtitle={t('v1099.subtitle', { threshold: thresholdDollars, year: report.year })}
        />

        <form action="/vendor-1099" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">{t('v1099.year')}</span>
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
            {t('v1099.reload')}
          </button>
        </form>

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('v1099.tile.vendorsPaid')} value={report.rows.length} />
          <Tile label={t('v1099.tile.reportable')} value={report.reportableCount} />
          <Tile label={t('v1099.tile.totalReportable')} value={<Money cents={report.totalReportableCents} />} />
          <Tile
            label={t('v1099.tile.missingW9')}
            value={report.missingW9Count}
            tone={report.missingW9Count > 0 ? 'danger' : 'success'}
          />
        </section>

        {report.missingW9Count > 0 ? (
          <Alert
            tone="danger"
            title={t('v1099.alert.title', { count: report.missingW9Count, plural: report.missingW9Count === 1 ? '' : 's' })}
            className="mb-4"
          >
            {t('v1099.alert.body', { threshold: thresholdDollars })}
          </Alert>
        ) : null}

        {report.rows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            {t('v1099.empty', { year: report.year })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('v1099.col.vendor')}</th>
                  <th className="px-4 py-2 text-right">{t('v1099.col.payments')}</th>
                  <th className="px-4 py-2 text-right">{t('v1099.col.paidYtd')}</th>
                  <th className="px-4 py-2">{t('v1099.col.is1099')}</th>
                  <th className="px-4 py-2">{t('v1099.col.w9')}</th>
                  <th className="px-4 py-2">{t('v1099.col.taxId')}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.rows.map((r) => (
                  <Row key={`${r.vendorId ?? r.vendorName}`} row={r} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function Row({ row, t }: { row: Vendor1099Row; t: Translator }) {
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
            {t('v1099.notInMaster')}
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
            ? <StatusPill label={t('v1099.file')} tone="info" />
            : <StatusPill label={t('v1099.underDollar')} tone="muted" />
          : <span className="text-xs text-gray-400">N/A</span>}
      </td>
      <td className="px-4 py-3">
        {row.missingCurrentW9
          ? <StatusPill label={t('v1099.missing')} tone="danger" />
          : row.is1099Reportable
            ? <StatusPill label={t('v1099.onFile')} tone="success" />
            : <span className="text-xs text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3">
        {row.missingTaxId
          ? <StatusPill label={t('v1099.missing')} tone="danger" />
          : row.is1099Reportable && row.overThreshold
            ? <StatusPill label={t('v1099.onFile')} tone="success" />
            : <span className="text-xs text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        {row.vendorId ? (
          <Link href={`/vendors/${row.vendorId}`} className="text-blue-700 hover:underline">
            {t('v1099.open')}
          </Link>
        ) : null}
      </td>
    </tr>
  );
}
