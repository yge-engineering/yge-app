// /vendors — vendor master list with compliance flags.
//
// Plain English: suppliers, subcontractors, and service providers.
// W-9 status and COI expiration tracked for 1099 reporting + insurance
// compliance. Subs without a current COI are blocked from working —
// they show in red here.

import Link from 'next/link';

import {
  AppShell,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  computeVendorRollup,
  maskTaxId,
  vendorCoiCurrent,
  vendorKindLabel,
  vendorPaymentTermsLabel,
  vendorW9Current,
  type Vendor,
  type VendorKind,
} from '@yge/shared';

const KINDS: VendorKind[] = [
  'SUPPLIER',
  'SUBCONTRACTOR',
  'EQUIPMENT_RENTAL',
  'TRUCKING',
  'PROFESSIONAL',
  'UTILITY',
  'GOVERNMENT',
  'OTHER',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchVendors(filter: { kind?: string }): Promise<Vendor[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/vendors`);
    if (filter.kind) url.searchParams.set('kind', filter.kind);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { vendors: Vendor[] }).vendors;
  } catch { return []; }
}
async function fetchAll(): Promise<Vendor[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { vendors: Vendor[] }).vendors;
  } catch { return []; }
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: { kind?: string };
}) {
  const [vendors, all] = await Promise.all([fetchVendors(searchParams), fetchAll()]);
  const rollup = computeVendorRollup(all);

  function buildHref(overrides: Partial<{ kind?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.kind) params.set('kind', merged.kind);
    const q = params.toString();
    return q ? `/vendors?${q}` : '/vendors';
  }

  const csvHref = `${publicApiBaseUrl()}/api/vendors?format=csv${
    searchParams.kind ? '&kind=' + encodeURIComponent(searchParams.kind) : ''
  }`;
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('vendors.title')}
          subtitle={t('vendors.subtitle')}
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {t('vendors.downloadCsv')}
              </a>
              <LinkButton href="/vendors/new" variant="primary" size="md">
                {t('vendors.add')}
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('vendors.tile.total')} value={rollup.total} />
          <Tile label={t('vendors.tile.onHold')} value={rollup.onHold} tone={rollup.onHold > 0 ? 'warn' : 'success'} />
          <Tile label={t('vendors.tile.missingW9')} value={rollup.missingW9} tone={rollup.missingW9 > 0 ? 'danger' : 'success'} />
          <Tile label={t('vendors.tile.missingCoi')} value={rollup.missingCoi} tone={rollup.missingCoi > 0 ? 'danger' : 'success'} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('vendors.filter.kind')}</span>
          <Link
            href={buildHref({ kind: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.kind ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('vendors.filter.all')}
          </Link>
          {KINDS.map((k) => (
            <Link
              key={k}
              href={buildHref({ kind: k })}
              className={`rounded px-2 py-1 text-xs ${searchParams.kind === k ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {vendorKindLabel(k)}
            </Link>
          ))}
        </section>

        {vendors.length === 0 ? (
          <EmptyState
            title={t('vendors.empty.title')}
            body={t('vendors.empty.body')}
            actions={[{ href: '/vendors/new', label: t('vendors.empty.action'), primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('vendors.col.vendor')}</th>
                  <th className="px-4 py-2">{t('vendors.col.kind')}</th>
                  <th className="px-4 py-2">{t('vendors.col.taxId')}</th>
                  <th className="px-4 py-2">{t('vendors.col.w9')}</th>
                  <th className="px-4 py-2">{t('vendors.col.coi')}</th>
                  <th className="px-4 py-2">{t('vendors.col.terms')}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map((v) => {
                  const w9Current = vendorW9Current(v);
                  const coiCurrent = vendorCoiCurrent(v);
                  const w9Issue = v.is1099Reportable && !w9Current;
                  const coiIssue = v.kind === 'SUBCONTRACTOR' && !coiCurrent;
                  const rowClass = v.onHold ? 'bg-red-50' : w9Issue || coiIssue ? 'bg-amber-50' : '';
                  return (
                    <tr key={v.id} className={rowClass}>
                      <td className="px-4 py-3">
                        <Link href={`/vendors/${v.id}`} className="font-medium text-blue-700 hover:underline">
                          {v.dbaName ?? v.legalName}
                        </Link>
                        {v.dbaName ? <div className="text-xs text-gray-500">{v.legalName}</div> : null}
                        {v.onHold ? (
                          <span className="mt-0.5 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                            {t('vendors.tag.onHold')}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{vendorKindLabel(v.kind)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">
                        {maskTaxId(v.taxId) || <span className="text-gray-400 font-sans">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {v.is1099Reportable
                          ? <StatusPill label={w9Current ? t('vendors.w9.onFile') : t('vendors.w9.needed')} tone={w9Current ? 'success' : 'danger'} />
                          : <span className="text-xs text-gray-400">{t('vendors.na')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {v.kind === 'SUBCONTRACTOR'
                          ? <StatusPill label={coiCurrent ? t('vendors.coi.to', { date: v.coiExpiresOn ?? '?' }) : t('vendors.coi.expired')} tone={coiCurrent ? 'success' : 'danger'} />
                          : <span className="text-xs text-gray-400">{t('vendors.na')}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{vendorPaymentTermsLabel(v.paymentTerms)}</td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
