'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  zip?: string | null;
  data?: { zip?: string | null };
}

function zp(v: Vendor): string { return (v.zip ?? v.data?.zip ?? '').trim().slice(0, 5); }

export function ByZipTable() {
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
    const z = zp(v) || '(unknown)';
    counts.set(z, (counts.get(z) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  const total = vendors.length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Zip</th>
            <th className="px-3 py-2 text-right">Vendors</th>
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
