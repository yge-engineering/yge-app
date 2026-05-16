'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  state?: string | null;
}

export function PrintStatePanel() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { vendors: [] }))
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []));
  }, []);

  if (!vendors) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const buckets = new Map<string, number>();
  for (const v of vendors) {
    const s = v.state?.trim().toUpperCase() || '— unknown —';
    buckets.set(s, (buckets.get(s) ?? 0) + 1);
  }
  const rows = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-300 text-left text-[11px] uppercase tracking-wide text-gray-600">
        <tr>
          <th className="py-2">State</th>
          <th className="py-2 text-right">Vendors</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {rows.map(([s, n]) => (
          <tr key={s}>
            <td className="py-2 font-mono text-xs text-gray-900">{s}</td>
            <td className="py-2 text-right font-semibold">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
