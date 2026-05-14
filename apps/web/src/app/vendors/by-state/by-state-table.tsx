'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor { id: string; data?: { state?: string | null } | null; state?: string | null }

export function VendorsByStateTable() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { vendors: [] }))
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []));
  }, []);

  if (!vendors) return <p className="text-sm text-gray-500">Loading…</p>;
  if (vendors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No vendors in the database yet.
      </p>
    );
  }

  const counts = new Map<string, number>();
  for (const v of vendors) {
    const raw = (v.state ?? v.data?.state ?? '').trim().toUpperCase();
    const key = raw || '(unknown)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = vendors.length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">State</th>
            <th className="px-3 py-2 text-right">Vendors</th>
            <th className="px-3 py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([state, count]) => (
            <tr key={state} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono font-semibold">{state}</td>
              <td className="px-3 py-2 text-right font-mono">{count}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{((count / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right font-mono">{total}</td>
            <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
