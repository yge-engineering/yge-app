'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Employee {
  id: string;
  hireDate?: string | null;
}

function monthKey(d?: string | null): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function PrintMonthHiredStatsPanel() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees?: Employee[] }) => setEmployees(j.employees ?? []));
  }, []);

  if (!employees) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const counts = new Map<string, number>();
  let missing = 0;
  for (const e of employees) {
    const k = monthKey(e.hireDate);
    if (k === null) missing += 1;
    else counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];

  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-gray-200">
        <tr>
          <td className="py-2 font-medium text-gray-900">Busiest month</td>
          <td className="py-2 text-right font-mono">{top ? `${top[0]} (${top[1]})` : '—'}</td>
        </tr>
        <tr>
          <td className="py-2 font-medium text-gray-900">Unique months</td>
          <td className="py-2 text-right font-semibold">{counts.size}</td>
        </tr>
        <tr>
          <td className="py-2 font-medium text-gray-900">Missing hire date</td>
          <td className="py-2 text-right font-semibold">{missing} / {employees.length}</td>
        </tr>
      </tbody>
    </table>
  );
}
