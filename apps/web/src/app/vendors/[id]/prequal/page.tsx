// /vendors/[id]/prequal — printable subcontractor pre-qualification packet.

import Link from 'next/link';

import { AppShell } from '../../../../components/app-shell';
import { notFound } from 'next/navigation';
import {
  buildVendorPrequal,
  coerceLocale,
  vendorKindLabel,
  vendorPaymentTermsLabel,
  type Vendor,
} from '@yge/shared';
import { getTranslator } from '../../../../lib/locale';
import { cookies } from 'next/headers';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchVendor(id: string): Promise<Vendor | null> {
  const res = await fetch(`${apiBaseUrl()}/api/vendors/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { vendor: Vendor }).vendor;
}

export default async function VendorPrequalPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
  const localeCookie = cookies().get('yge-locale')?.value;
  const locale = coerceLocale(localeCookie);
  const vendor = await fetchVendor(params.id);
  if (!vendor) notFound();

  const report = buildVendorPrequal(vendor, new Date(), locale);

  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/vendors/${vendor.id}`} className="text-sm text-yge-blue-500 hover:underline">
          {t('prequalPg.back')}
        </Link>
        <span className="text-xs text-gray-500">{t('prequalPg.printHint')}</span>
      </div>

      <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
        <header className="mb-4 flex items-end justify-between border-b-2 border-black pb-2">
          <div>
            <div className="text-xs uppercase tracking-wide">
              {t('prequalPg.docTitle')}
            </div>
            <h1 className="text-2xl font-bold">{report.vendorName}</h1>
            {vendor.dbaName && (
              <p className="text-sm text-gray-600">{t('prequalPg.legalLabel', { name: vendor.legalName })}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide">Young General Engineering, Inc.</div>
            <div className="text-xs">19645 Little Woods Rd, Cottonwood CA 96022</div>
            <div className="text-xs">{t('prequalPg.generated', { date: new Date().toISOString().slice(0, 10) })}</div>
          </div>
        </header>

        <div
          className={`mb-4 rounded border p-3 ${
            report.ready
              ? 'border-green-400 bg-green-50'
              : 'border-red-400 bg-red-50'
          }`}
        >
          <div className="text-xs uppercase tracking-wide">{t('prequalPg.statusLabel')}</div>
          <div className="text-lg font-bold">
            {report.ready
              ? t('prequalPg.statusReady')
              : (report.blockingCount === 1
                  ? t('prequalPg.statusBlockedOne', { count: report.blockingCount })
                  : t('prequalPg.statusBlockedMany', { count: report.blockingCount }))}
          </div>
          {report.advisoryCount > 0 && (
            <div className="mt-1 text-xs text-gray-700">
              {report.advisoryCount === 1
                ? t('prequalPg.advisoryOne', { count: report.advisoryCount })
                : t('prequalPg.advisoryMany', { count: report.advisoryCount })}
            </div>
          )}
        </div>

        <section className="mb-4 grid grid-cols-2 gap-3 text-xs">
          <Field label={t('prequalPg.lblKind')}>{vendorKindLabel(vendor.kind, locale)}</Field>
          <Field label={t('prequalPg.lblPaymentTerms')}>{vendorPaymentTermsLabel(vendor.paymentTerms, locale)}</Field>
          <Field label={t('prequalPg.lblAddress')}>
            {[vendor.addressLine, vendor.city, vendor.state, vendor.zip]
              .filter((s) => s && s.trim().length > 0)
              .join(', ') || '—'}
          </Field>
          <Field label={t('prequalPg.lblContact')}>
            {vendor.contactName ?? '—'}
            {vendor.phone ? ` · ${vendor.phone}` : ''}
            {vendor.email ? ` · ${vendor.email}` : ''}
          </Field>
        </section>

        <section>
          <h2 className="rounded bg-gray-200 px-2 py-1 text-xs font-bold uppercase">
            {t('prequalPg.checklistHeader')}
          </h2>
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="w-8 px-1 py-1 text-left">#</th>
                <th className="px-1 py-1 text-left">{t('prequalPg.thItem')}</th>
                <th className="w-32 px-1 py-1 text-left">{t('prequalPg.thDetail')}</th>
                <th className="w-16 px-1 py-1 text-center">{t('prequalPg.thStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {report.checks.map((c, i) => (
                <tr key={c.id} className="border-b border-gray-200 align-top">
                  <td className="px-1 py-2">{i + 1}</td>
                  <td className="px-1 py-2">
                    <div className="font-semibold">
                      {c.label}
                      {c.required && (
                        <span className="ml-1 text-red-700">*</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-600">{c.description}</div>
                  </td>
                  <td className="px-1 py-2 text-gray-700">{c.detail ?? '—'}</td>
                  <td className="px-1 py-2 text-center">
                    {c.pass ? (
                      <span className="font-bold text-green-700">{t('prequalPg.pass')}</span>
                    ) : c.required ? (
                      <span className="font-bold text-red-700">{t('prequalPg.fail')}</span>
                    ) : (
                      <span className="font-semibold text-yellow-700">{t('prequalPg.flag')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] italic text-gray-600">
            <span className="text-red-700">*</span> {t('prequalPg.footnote')}
          </p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="font-semibold uppercase">{t('prequalPg.reviewedBy')}</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
            <div className="mt-1 text-gray-600">{t('prequalPg.signLine')}</div>
          </div>
          <div>
            <div className="font-semibold uppercase">{t('prequalPg.dateLabel')}</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
          </div>
        </section>
      </article>
    </main>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase text-gray-700">{label}</div>
      <div className="mt-0.5 border-b border-gray-300 pb-0.5 text-sm">{children}</div>
    </div>
  );
}
