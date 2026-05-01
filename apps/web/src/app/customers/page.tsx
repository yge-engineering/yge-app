// /customers — customer master list.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  computeCustomerRollup,
  customerDisplayName,
  customerKindLabel,
  isPublicAgency,
  type Customer,
  type CustomerKind,
} from '@yge/shared';

const KINDS: CustomerKind[] = [
  'STATE_AGENCY',
  'FEDERAL_AGENCY',
  'COUNTY',
  'CITY',
  'SPECIAL_DISTRICT',
  'PRIVATE_OWNER',
  'PRIME_CONTRACTOR',
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

async function fetchCustomers(filter: { kind?: string }): Promise<Customer[]> {
  const url = new URL(`${apiBaseUrl()}/api/customers`);
  if (filter.kind) url.searchParams.set('kind', filter.kind);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { customers: Customer[] }).customers;
}
async function fetchAll(): Promise<Customer[]> {
  const res = await fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { customers: Customer[] }).customers;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { kind?: string };
}) {
  const [customers, all] = await Promise.all([fetchCustomers(searchParams), fetchAll()]);
  const rollup = computeCustomerRollup(all);

  function buildHref(overrides: Partial<{ kind?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.kind) params.set('kind', merged.kind);
    const q = params.toString();
    return q ? `/customers?${q}` : '/customers';
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`${publicApiBaseUrl()}/api/customers?format=csv${searchParams.kind ? '&kind=' + encodeURIComponent(searchParams.kind) : ''}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Download CSV
          </a>
          <Link
            href="/customers/new"
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + Add customer
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Customers</h1>
      <p className="mt-2 text-gray-700">
        Agencies, owners, and primes that YGE bills. Public agencies (state,
        federal, county, city, special district) trigger DIR + certified
        payroll requirements on every job.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={rollup.total} />
        <Stat label="Active" value={rollup.active} />
        <Stat label="On hold" value={rollup.onHold} variant={rollup.onHold > 0 ? 'warn' : 'ok'} />
        <Stat label="Public agencies" value={rollup.publicAgencies} />
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
            {customerKindLabel(k)}
          </Link>
        ))}
      </section>

      {customers.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No customers in this filter. Click <em>Add customer</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Terms</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr key={c.id} className={c.onHold ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">
                      {customerDisplayName(c)}
                    </div>
                    {c.dbaName && (
                      <div className="text-xs text-gray-500">{c.legalName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {customerKindLabel(c.kind)}
                    {isPublicAgency(c) && (
                      <div className="mt-0.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                        Public works
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {c.contactName ?? '—'}
                    {c.phone && <div className="text-[10px] text-gray-500">{c.phone}</div>}
                    {c.email && <div className="text-[10px] text-gray-500">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {c.paymentTerms ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.onHold ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800">
                        On hold
                      </span>
                    ) : (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link href={`/customers/${c.id}`} className="text-yge-blue-500 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </AppShell>
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
