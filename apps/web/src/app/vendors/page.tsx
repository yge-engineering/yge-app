// /vendors — vendor master list with compliance flags.

import Link from 'next/link';
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

async function fetchVendors(filter: { kind?: string }): Promise<Vendor[]> {
  const url = new URL(`${apiBaseUrl()}/api/vendors`);
  if (filter.kind) url.searchParams.set('kind', filter.kind);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { vendors: Vendor[] }).vendors;
}
async function fetchAll(): Promise<Vendor[]> {
  const res = await fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { vendors: Vendor[] }).vendors;
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

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/vendors/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + Add vendor
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Vendors</h1>
      <p className="mt-2 text-gray-700">
        Suppliers, subcontractors, and service providers. W-9 status and
        COI expiration tracked for 1099 reporting + insurance compliance.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={rollup.total} />
        <Stat label="On hold" value={rollup.onHold} variant={rollup.onHold > 0 ? 'warn' : 'ok'} />
        <Stat label="Missing W-9" value={rollup.missingW9} variant={rollup.missingW9 > 0 ? 'bad' : 'ok'} />
        <Stat label="Subs missing COI" value={rollup.missingCoi} variant={rollup.missingCoi > 0 ? 'bad' : 'ok'} />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Kind:</span>
        <Link
          href={buildHref({ kind: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.kind ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {KINDS.map((k) => (
          <Link
            key={k}
            href={buildHref({ kind: k })}
            className={`rounded px-2 py-1 text-xs ${searchParams.kind === k ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {vendorKindLabel(k)}
          </Link>
        ))}
      </section>

      {vendors.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No vendors yet. Click <em>Add vendor</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Tax ID</th>
                <th className="px-4 py-2">W-9</th>
                <th className="px-4 py-2">COI</th>
                <th className="px-4 py-2">Terms</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendors.map((v) => {
                const w9Current = vendorW9Current(v);
                const coiCurrent = vendorCoiCurrent(v);
                const w9Issue = v.is1099Reportable && !w9Current;
                const coiIssue = v.kind === 'SUBCONTRACTOR' && !coiCurrent;
                const rowClass = v.onHold ? 'bg-red-50' : (w9Issue || coiIssue) ? 'bg-yellow-50' : '';
                return (
                  <tr key={v.id} className={rowClass}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {v.dbaName ?? v.legalName}
                      </div>
                      {v.dbaName && (
                        <div className="text-xs text-gray-500">{v.legalName}</div>
                      )}
                      {v.onHold && (
                        <span className="mt-0.5 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                          on hold
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {vendorKindLabel(v.kind)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {maskTaxId(v.taxId) || <span className="text-gray-400 font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {v.is1099Reportable ? (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 font-semibold ${w9Current ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {w9Current ? 'on file' : 'needed'}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {v.kind === 'SUBCONTRACTOR' ? (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 font-semibold ${coiCurrent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {coiCurrent ? `to ${v.coiExpiresOn ?? '?'}` : 'expired'}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {vendorPaymentTermsLabel(v.paymentTerms)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/vendors/${v.id}`} className="text-yge-blue-500 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
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
