'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer {
  id: string;
  name?: string | null;
  email?: string | null;
}

function domainOf(email?: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function WithDomainPanel() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((j: { customers?: Customer[] }) => setCustomers(j.customers ?? []));
  }, []);

  if (!customers) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const rows = customers
    .map((c) => ({ ...c, _domain: domainOf(c.email) }))
    .filter((c): c is Customer & { _domain: string } => c._domain !== null)
    .sort((a, b) => (a._domain < b._domain ? -1 : a._domain > b._domain ? 1 : 0));

  if (rows.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500">
        No customers with a recognisable email domain yet.
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        {rows.length} customer{rows.length === 1 ? '' : 's'}.
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Domain</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2">
                <Link href={`/customers/${c.id}`} className="text-yge-blue-700 hover:underline">
                  {c.name ?? '— unnamed —'}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{c.email}</td>
              <td className="px-3 py-2 font-mono text-xs text-yge-blue-900">{c._domain}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
