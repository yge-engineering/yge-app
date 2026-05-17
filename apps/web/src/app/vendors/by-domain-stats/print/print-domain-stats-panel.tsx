'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  email?: string | null;
}

function domainOf(email?: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function PrintDomainStatsPanel() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { vendors: [] }))
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []));
  }, []);

  if (!vendors) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const counts = new Map<string, number>();
  let missing = 0;
  for (const v of vendors) {
    const d = domainOf(v.email);
    if (d === null) missing += 1;
    else counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];

  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-gray-200">
        <tr>
          <td className="py-2 font-medium text-gray-900">Top domain</td>
          <td className="py-2 text-right font-mono">{top ? `${top[0]} (${top[1]})` : '—'}</td>
        </tr>
        <tr>
          <td className="py-2 font-medium text-gray-900">Unique domains</td>
          <td className="py-2 text-right font-semibold">{counts.size}</td>
        </tr>
        <tr>
          <td className="py-2 font-medium text-gray-900">Missing email</td>
          <td className="py-2 text-right font-semibold">{missing} / {vendors.length}</td>
        </tr>
      </tbody>
    </table>
  );
}
