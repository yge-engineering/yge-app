'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer {
  id: string;
  createdAt?: string;
  legalName?: string;
  dbaName?: string;
  kind?: string;
  email?: string;
}

export function ThisWeekTable() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((j: { customers?: Customer[] }) => setCustomers(j.customers ?? []));
  }, []);

  if (!customers) return <p className="text-sm text-gray-500">Loading…</p>;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const iso = cutoff.toISOString().slice(0, 10);
  const rows = customers
    .filter((c) => (c.createdAt ?? '') >= iso)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No customers added in the past 7 days.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Added</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Email</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{(c.createdAt ?? '').slice(0, 10) || '—'}</td>
              <td className="px-3 py-2">
                <Link href={`/customers/${c.id}`} className="font-semibold text-yge-blue-700 hover:underline">
                  {c.dbaName ?? c.legalName ?? c.id}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{c.kind ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-700">{c.email ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
