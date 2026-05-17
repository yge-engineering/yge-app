'use client';

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

export function PrintStateDomainDetailPanel() {
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
    return <p className="text-xs text-gray-500">No customers yet.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map(([key, list]) => (
        <section key={key} className="break-inside-avoid">
          <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold text-gray-900">
            {key} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="mt-1 space-y-0.5 text-xs">
            {list.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="text-gray-900">{c.name ?? '— unnamed —'}</span>
                <span className="font-mono text-gray-500">{c.email ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
