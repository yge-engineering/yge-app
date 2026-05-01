// /customers — customer master list.
//
// Plain English: agencies, owners, and primes that YGE bills. Public
// agencies (state, federal, county, city, special district) trigger
// DIR + certified payroll requirements on every job — that's the
// "Public works" tag on the Kind column.

import Link from 'next/link';

import {
  AppShell,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
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
  try {
    const url = new URL(`${apiBaseUrl()}/api/customers`);
    if (filter.kind) url.searchParams.set('kind', filter.kind);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { customers: Customer[] }).customers;
  } catch { return []; }
}
async function fetchAll(): Promise<Customer[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { customers: Customer[] }).customers;
  } catch { return []; }
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

  const csvHref = `${publicApiBaseUrl()}/api/customers?format=csv${
    searchParams.kind ? '&kind=' + encodeURIComponent(searchParams.kind) : ''
  }`;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Customers"
          subtitle="Agencies, owners, and primes that YGE bills. Public agencies trigger DIR + certified-payroll requirements on every job."
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Download CSV
              </a>
              <LinkButton href="/customers/new" variant="primary" size="md">
                + Add customer
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total" value={rollup.total} />
          <Tile label="Active" value={rollup.active} />
          <Tile label="On hold" value={rollup.onHold} tone={rollup.onHold > 0 ? 'warn' : 'success'} />
          <Tile label="Public agencies" value={rollup.publicAgencies} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Kind:</span>
          <Link
            href={buildHref({ kind: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.kind ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {KINDS.map((k) => (
            <Link
              key={k}
              href={buildHref({ kind: k })}
              className={`rounded px-2 py-1 text-xs ${searchParams.kind === k ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {customerKindLabel(k)}
            </Link>
          ))}
        </section>

        {customers.length === 0 ? (
          <EmptyState
            title="No customers in this filter"
            body="Add agencies and primes here as you onboard them. The Public-works flag drives DIR + CPR enforcement on jobs they create."
            actions={[{ href: '/customers/new', label: 'Add customer', primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
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
                      <Link href={`/customers/${c.id}`} className="font-medium text-blue-700 hover:underline">
                        {customerDisplayName(c)}
                      </Link>
                      {c.dbaName ? <div className="text-xs text-gray-500">{c.legalName}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {customerKindLabel(c.kind)}
                      {isPublicAgency(c) ? (
                        <div className="mt-0.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                          Public works
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {c.contactName ?? '—'}
                      {c.phone ? <div className="text-[10px] text-gray-500">{c.phone}</div> : null}
                      {c.email ? <div className="text-[10px] text-gray-500">{c.email}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{c.paymentTerms ?? '—'}</td>
                    <td className="px-4 py-3">
                      {c.onHold
                        ? <StatusPill label="On hold" tone="danger" />
                        : <StatusPill label="Active" tone="success" />}
                    </td>
                    <td className="px-4 py-3"></td>
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
