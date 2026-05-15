'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Employee {
  id: string;
  name?: string | null;
  hireDate?: string | null;
}

function monthKey(d?: string | null): string {
  if (!d) return 'unknown';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 'unknown';
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function ByMonthHiredPanel() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees?: Employee[] }) => setEmployees(j.employees ?? []));
  }, []);

  if (!employees) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const buckets = new Map<string, number>();
  for (const e of employees) {
    const k = monthKey(e.hireDate);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const rows = Array.from(buckets.entries()).sort((a, b) => {
    if (a[0] === 'unknown') return 1;
    if (b[0] === 'unknown') return -1;
    return a[0] < b[0] ? 1 : -1;
  });

  const max = Math.max(0, ...rows.map(([, n]) => n));

  return (
    <div className="rounded border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Month</th>
            <th className="px-3 py-2">Bar</th>
            <th className="px-3 py-2 text-right">Hires</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(([month, n]) => {
            const pct = max > 0 ? (n / max) * 100 : 0;
            return (
              <tr key={month}>
                <td className="px-3 py-2 font-mono text-xs text-yge-blue-900">{month}</td>
                <td className="px-3 py-2">
                  <div className="h-2 w-full rounded bg-gray-100">
                    <div className="h-full rounded bg-yge-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{n}</td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-500">No employees yet.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
