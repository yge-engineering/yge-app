// /vendor-1099/print — printable 1099-NEC worksheet.
//
// One page per over-threshold vendor with everything the CPA
// needs to type into the IRS-filing software: payer (YGE), payee
// vendor (name / address / TaxID), and Box 1 (Nonemployee Comp).

import {
  AppShell,
  Money,
  PageHeader,
} from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import {
  buildVendor1099Report,
  type ApPayment,
  type Vendor,
  YGE_COMPANY_INFO,
} from '@yge/shared';
import { PrintButton } from '../../../components/print-button';

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

async function fetchPayments(): Promise<ApPayment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ap-payments`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ApPayment[] }).payments;
  } catch {
    return [];
  }
}

export default async function Vendor1099PrintPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  requirePermission('financials:view');
  const yearArg = Number(searchParams.year);
  const year =
    Number.isFinite(yearArg) && yearArg >= 2000 && yearArg <= 2100
      ? yearArg
      : new Date().getFullYear() - 1;

  const [vendors, payments] = await Promise.all([
    fetchVendors(),
    fetchPayments(),
  ]);
  const report = buildVendor1099Report({ year, vendors, payments });
  const filed = report.rows.filter((r) => r.overThreshold);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl print:max-w-none print:p-0">
        <div className="print:hidden">
          <PageHeader
            title={`1099-NEC worksheet — ${year}`}
            subtitle={`${filed.length} reportable vendor${filed.length === 1 ? '' : 's'} (paid ≥ $${(report.thresholdCents / 100).toFixed(0)} in ${year}).`}
            actions={<PrintButton />}
          />
        </div>

        <header className="hidden print:block print:mb-6">
          <h1 className="text-2xl font-bold">1099-NEC Worksheet — {year}</h1>
          <p className="text-sm">
            Payer: {YGE_COMPANY_INFO.legalName} · CSLB{' '}
            {YGE_COMPANY_INFO.cslbLicense}
          </p>
        </header>

        {filed.length === 0 ? (
          <p className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            No over-threshold reportable vendors in {year}. Nothing to file. ✓
          </p>
        ) : (
          <div className="space-y-8">
            {filed.map((row) => {
              const v = row.vendorId ? vendorById.get(row.vendorId) : undefined;
              return (
                <section
                  key={row.vendorName + row.vendorId}
                  className="break-inside-avoid rounded-md border border-gray-300 bg-white p-5"
                >
                  <header className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-lg font-bold text-yge-blue-900 print:text-black">
                      {row.vendorName}
                    </h2>
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                      Form 1099-NEC, Box 1
                    </span>
                  </header>

                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">
                        Payer (YGE)
                      </dt>
                      <dd className="mt-1 whitespace-pre-line text-gray-900">
                        {YGE_COMPANY_INFO.legalName}
                        {'\n'}
                        {YGE_COMPANY_INFO.address.street}
                        {'\n'}
                        {YGE_COMPANY_INFO.address.city},{' '}
                        {YGE_COMPANY_INFO.address.state}{' '}
                        {YGE_COMPANY_INFO.address.zip}
                      </dd>
                      <dt className="mt-3 text-xs uppercase tracking-wide text-gray-500">
                        Payer TIN
                      </dt>
                      <dd className="mt-1 font-mono text-gray-900">
                        — (set on master profile)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">
                        Recipient
                      </dt>
                      <dd className="mt-1 whitespace-pre-line text-gray-900">
                        {row.vendorName}
                        {v?.addressLine ? '\n' + v.addressLine : ''}
                        {v?.city || v?.state || v?.zip
                          ? '\n' +
                            [v?.city, v?.state, v?.zip]
                              .filter(Boolean)
                              .join(' ')
                          : ''}
                      </dd>
                      <dt className="mt-3 text-xs uppercase tracking-wide text-gray-500">
                        Recipient TIN
                      </dt>
                      <dd className="mt-1 font-mono text-gray-900">
                        {v?.taxId ?? (
                          <span className="text-red-700">⚠ missing — collect W-9</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 grid grid-cols-3 gap-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">
                        Box 1 — Nonemployee Compensation
                      </div>
                      <div className="mt-1 font-mono text-lg font-bold text-gray-900">
                        <Money cents={row.paidYtdCents} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">
                        # Payments
                      </div>
                      <div className="mt-1 font-mono text-lg text-gray-900">
                        {row.paymentCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">
                        W-9 on file
                      </div>
                      <div
                        className={`mt-1 font-mono text-lg ${
                          v?.w9OnFile ? 'text-green-800' : 'text-red-700'
                        }`}
                      >
                        {v?.w9OnFile ? '✓ Yes' : '✗ No'}
                      </div>
                    </div>
                  </div>

                  {row.missingTaxId || !v?.w9OnFile ? (
                    <p className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                      ⚠ Missing TIN or current W-9 — IRS won't accept the 1099 until
                      this is resolved. Email the vendor a W-9 request.
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-xs text-gray-500 print:mt-4">
          Generated {new Date().toISOString().slice(0, 16)} by YGE App. This is a
          worksheet for the CPA — actual 1099-NEC filing happens through your
          tax-prep software.
        </p>
      </main>
    </AppShell>
  );
}
