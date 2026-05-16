'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer {
  id: string;
  state?: string | null;
  email?: string | null;
}

function domainOf(email?: string | null): string {
  if (!email) return '— none —';
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return '— none —';
  return email.slice(at + 1).trim().toLowerCase();
}

const TOP_N = 6;

export function TwoDPanel() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((j: { customers?: Customer[] }) => setCustomers(j.customers ?? []));
  }, []);

  if (!customers) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  // pick top-N domains by count
  const domainCount = new Map<string, number>();
  for (const c of customers) {
    const d = domainOf(c.email);
    domainCount.set(d, (domainCount.get(d) ?? 0) + 1);
  }
  const topDomains = Array.from(domainCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([d]) => d);

  // cells keyed by state||domain
  const states = new Set<string>();
  const cells = new Map<string, number>();
  for (const c of customers) {
    const s = c.state?.trim().toUpperCase() || '—';
    let d = domainOf(c.email);
    if (!topDomains.includes(d)) d = 'other';
    states.add(s);
    const k = `${s}|${d}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  }
  const cols = [...topDomains, 'other'];
  const sList = Array.from(states).sort();

  if (sList.length === 0) {
    return <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500">No customers yet.</div>;
  }

  return (
    <div className="overflow-auto rounded border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">State</th>
            {cols.map((d) => (
              <th key={d} className="px-3 py-2 text-right font-mono normal-case">{d}</th>
            ))}
            <th className="px-3 py-2 text-right">Row total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sList.map((s) => {
            let rowTotal = 0;
            const tds = cols.map((d) => {
              const n = cells.get(`${s}|${d}`) ?? 0;
              rowTotal += n;
              return (
                <td key={d} className="px-3 py-2 text-right text-xs font-mono">
                  {n > 0 ? n : <span className="text-gray-300">·</span>}
                </td>
              );
            });
            return (
              <tr key={s}>
                <td className="px-3 py-2 text-left font-medium text-gray-900">{s}</td>
                {tds}
                <td className="px-3 py-2 text-right font-semibold">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
