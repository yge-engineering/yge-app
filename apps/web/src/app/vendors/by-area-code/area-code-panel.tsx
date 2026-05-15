'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  name?: string | null;
  phone?: string | null;
}

function areaCode(phone?: string | null): string {
  if (!phone) return 'unknown';
  const digits = phone.replace(/\D+/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10, -7);
  }
  if (digits.length >= 3) {
    return digits.slice(0, 3);
  }
  return 'unknown';
}

export function AreaCodePanel() {
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
    const k = areaCode(v.phone);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const rows = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Area code</th>
            <th className="px-3 py-2 text-right">Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(([code, n]) => (
            <tr key={code}>
              <td className="px-3 py-2 font-mono text-xs text-yge-blue-900">{code}</td>
              <td className="px-3 py-2 text-right font-semibold">{n}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr><td colSpan={2} className="px-3 py-6 text-center text-xs text-gray-500">No vendors yet.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
