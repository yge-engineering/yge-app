'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer {
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
    const d = domainOf(c.email);
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
          <td className="py-2 text-right font-semibold">{missing} / {customers.length}</td>
        </tr>
      </tbody>
    </table>
  );
}
