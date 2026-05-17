'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer {
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
  const [customers, setCustomers] = useState<Customer[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((j: { customers?: Customer[] }) => setCustomers(j.customers ?? []));
  }, []);

  if (!customers) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const counts = new Map<string, number>();
  let missing = 0;
  for (const c of customers) {
    const a = areaCode(c.phone);
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
          <td className="py-2 text-right font-semibold">{missing} / {customers.length}</td>
        </tr>
      </tbody>
    </table>
  );
}
