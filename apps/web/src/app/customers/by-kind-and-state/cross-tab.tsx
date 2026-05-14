'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; state?: string | null; kind?: string | null }

export function CrossTab() {
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

  const states = new Set<string>();
  const kinds = new Set<string>();
  const grid = new Map<string, Map<string, number>>();
  for (const c of customers) {
    const s = (c.state ?? '').trim().toUpperCase() || '(unknown)';
    const k = (c.kind ?? '').trim().toUpperCase() || '(unknown)';
    states.add(s);
    kinds.add(k);
    if (!grid.has(k)) grid.set(k, new Map());
    const row = grid.get(k)!;
    row.set(s, (row.get(s) ?? 0) + 1);
  }
  const sortedStates = [...states].sort();
  const sortedKinds = [...kinds].sort();

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Kind \\ State</th>
            {sortedStates.map((s) => (
              <th key={s} className="px-3 py-2 text-right font-mono">{s}</th>
            ))}
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sortedKinds.map((k) => {
            const row = grid.get(k) ?? new Map<string, number>();
            const rowTotal = [...row.values()].reduce((a, b) => a + b, 0);
            return (
              <tr key={k} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono font-semibold">{k}</td>
                {sortedStates.map((s) => (
                  <td key={s} className="px-3 py-2 text-right font-mono">{row.get(s) ?? 0}</td>
                ))}
                <td className="px-3 py-2 text-right font-mono font-semibold">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
