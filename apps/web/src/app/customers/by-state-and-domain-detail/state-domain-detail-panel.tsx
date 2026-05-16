'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer {
  id: string;
  name?: string | null;
  state?: string | null;
  email?: string | null;
}

function domainOf(email?: string | null): string {
  if (!email) return '— none —';
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return '— none —';
  return email.slice(at + 1).trim().toLowerCase();
}

export function StateDomainDetailPanel() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((j: { customers?: Customer[] }) => setCustomers(j.customers ?? []));
  }, []);

  if (!customers) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const grouped = new Map<string, Customer[]>();
  for (const c of customers) {
    const s = c.state?.trim().toUpperCase() || '—';
    const d = domainOf(c.email);
    const k = `${s}  ·  ${d}`;
    const list = grouped.get(k);
    if (list) list.push(c);
    else grouped.set(k, [c]);
  }
  const sections = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);

  if (sections.length === 0) {
    return <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500">No customers yet.</div>;
  }

  return (
    <div className="space-y-4">
      {sections.map(([key, list]) => (
        <section key={key} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-yge-blue-900">
            {key} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="space-y-1">
            {list.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-xs">
                <Link href={`/customers/${c.id}`} className="text-yge-blue-700 hover:underline">
                  {c.name ?? '— unnamed —'}
                </Link>
                <span className="font-mono text-gray-500">{c.email ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
