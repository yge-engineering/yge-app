'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; zip?: string | null }

export function ByZipTable() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((j: { customers?: Customer[] }) => setCustomers(j.customers ?? []));
  }, []);

  if (!customers) return <p className="text-sm text-gray-500">Loading…</p>;
  if (customers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No customers in the database yet.
      </p>
    );
  }

  const counts = new Map<string, number>();
  for (const c of customers) {
    const z = (c.zip ?? '').trim().slice(0, 5) || '(unknown)';
    counts.set(z, (counts.get(z) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  const total = customers.length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Zip</th>
            <th className="px-3 py-2 text-right">Customers</th>
            <th className="px-3 py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([zip, count]) => (
            <tr key={zip} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono font-semibold">{zip}</td>
              <td className="px-3 py-2 text-right font-mono">{count}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{((count / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
