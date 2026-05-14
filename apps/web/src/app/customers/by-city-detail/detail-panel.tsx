'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer {
  id: string;
  legalName?: string;
  dbaName?: string;
  city?: string | null;
  state?: string | null;
  kind?: string | null;
}

export function ByCityDetail() {
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

  const groups = new Map<string, Customer[]>();
  for (const c of customers) {
    const city = (c.city ?? '').trim();
    const state = (c.state ?? '').trim().toUpperCase();
    const k = city && state ? `${city}, ${state}` : (city || state || '(unknown)');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(c);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-3">
      {sorted.map(([city, list]) => (
        <details key={city} className="rounded border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
            <span className="font-semibold text-gray-900">{city}</span>
            <span className="text-xs text-gray-600">{list.length} customer{list.length === 1 ? '' : 's'}</span>
          </summary>
          <ul className="divide-y divide-gray-100 px-3 pb-2 text-sm">
            {list.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                <Link href={`/customers/${c.id}`} className="font-medium text-yge-blue-700 hover:underline">
                  {c.dbaName ?? c.legalName ?? c.id}
                </Link>
                <span className="font-mono text-[10px] text-gray-500">{c.kind ?? ''}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
