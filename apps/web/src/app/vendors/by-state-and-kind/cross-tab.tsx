'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  state?: string | null;
  kind?: string;
  data?: { state?: string | null; kind?: string };
}

function st(v: Vendor): string { return ((v.state ?? v.data?.state) ?? '').trim().toUpperCase() || '(unknown)'; }
function kn(v: Vendor): string { return ((v.kind ?? v.data?.kind) ?? '').trim().toUpperCase() || '(unknown)'; }

export function CrossTab() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { vendors: [] }))
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []));
  }, []);

  if (!vendors) return <p className="text-sm text-gray-500">Loading…</p>;
  if (vendors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No vendors in the database yet.
      </p>
    );
  }

  const states = new Set<string>();
  const kinds = new Set<string>();
  const grid = new Map<string, Map<string, number>>();
  for (const v of vendors) {
    const s = st(v);
    const k = kn(v);
    states.add(s);
    kinds.add(k);
    if (!grid.has(s)) grid.set(s, new Map());
    const row = grid.get(s)!;
    row.set(k, (row.get(k) ?? 0) + 1);
  }
  const sortedStates = [...states].sort();
  const sortedKinds = [...kinds].sort();

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">State \\ Kind</th>
            {sortedKinds.map((k) => (
              <th key={k} className="px-3 py-2 text-right font-mono">{k}</th>
            ))}
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sortedStates.map((s) => {
            const row = grid.get(s) ?? new Map<string, number>();
            const rowTotal = [...row.values()].reduce((a, b) => a + b, 0);
            return (
              <tr key={s} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono font-semibold">{s}</td>
                {sortedKinds.map((k) => (
                  <td key={k} className="px-3 py-2 text-right font-mono">{row.get(k) ?? 0}</td>
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
