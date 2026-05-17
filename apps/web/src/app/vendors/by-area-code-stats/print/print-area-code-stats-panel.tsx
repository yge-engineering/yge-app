'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  phone?: string | null;
}

function areaCode(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, '');
  if (digits.length >= 10) return digits.slice(-10, -7);
  if (digits.length >= 3) return digits.slice(0, 3);
  return null;
}

export function PrintAreaCodeStatsPanel() {
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
    const a = areaCode(v.phone);
    if (a === null) missing += 1;
    else counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];

  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-gray-200">
        <tr>
          <td className="py-2 font-medium text-gray-900">Top area code</td>
          <td className="py-2 text-right font-mono">{top ? `${top[0]} (${top[1]})` : '—'}</td>
        </tr>
        <tr>
          <td className="py-2 font-medium text-gray-900">Unique area codes</td>
          <td className="py-2 text-right font-semibold">{counts.size}</td>
        </tr>
        <tr>
          <td className="py-2 font-medium text-gray-900">Missing phone</td>
          <td className="py-2 text-right font-semibold">{missing} / {vendors.length}</td>
        </tr>
      </tbody>
    </table>
  );
}
