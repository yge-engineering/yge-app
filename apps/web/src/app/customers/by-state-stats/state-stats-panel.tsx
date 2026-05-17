'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer {
  id: string;
  state?: string | null;
}

export function StateStatsPanel() {
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
    const s = c.state?.trim().toUpperCase();
    if (!s) missing += 1;
    else counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat label="Top state" value={top ? top[0] : '—'} sub={top ? `${top[1]} customers` : 'no states yet'} />
      <Stat label="Unique states" value={String(counts.size)} sub={`across ${customers.length - missing} customers`} />
      <Stat label="Missing state" value={String(missing)} sub={`of ${customers.length} customers`} tone={missing > 0 ? 'warn' : 'good'} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'warn' | 'bad' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-700' : 'text-yge-blue-900';
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-gray-500">{sub}</div>
    </div>
  );
}
