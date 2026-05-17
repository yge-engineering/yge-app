'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer {
  id: string;
  name?: string | null;
  state?: string | null;
}

export function PrintStateDetailPanel() {
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
    const k = c.state?.trim().toUpperCase() || '— unknown —';
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
      {sections.map(([s, list]) => (
        <section key={s} className="break-inside-avoid">
          <h2 className="border-b border-gray-300 pb-1 font-mono text-sm font-semibold text-gray-900">
            {s} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="mt-1 space-y-0.5 text-xs">
            {list.map((c) => (
              <li key={c.id} className="text-gray-900">{c.name ?? '— unnamed —'}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
