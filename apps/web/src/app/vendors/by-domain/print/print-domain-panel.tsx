'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  email?: string | null;
}

function domainOf(email?: string | null): string {
  if (!email) return 'missing';
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return 'missing';
  return email.slice(at + 1).trim().toLowerCase();
}

export function PrintDomainPanel() {
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
    const k = domainOf(v.email);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const rows = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-300 text-left text-[11px] uppercase tracking-wide text-gray-600">
        <tr>
          <th className="py-2">Domain</th>
          <th className="py-2 text-right">Vendors</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {rows.map(([d, n]) => (
          <tr key={d}>
            <td className="py-2 font-mono text-xs text-gray-900">{d}</td>
            <td className="py-2 text-right font-semibold">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
