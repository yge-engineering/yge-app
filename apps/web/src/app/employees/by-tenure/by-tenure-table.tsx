'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Employee {
  id: string;
  status?: string | null;
  hireDate?: string | null;
}

interface Bucket { label: string; minYears: number; maxYears: number; count: number }

const BUCKETS: Array<{ label: string; minYears: number; maxYears: number }> = [
  { label: '< 1 yr', minYears: 0, maxYears: 1 },
  { label: '1 – 3 yrs', minYears: 1, maxYears: 3 },
  { label: '3 – 5 yrs', minYears: 3, maxYears: 5 },
  { label: '5 – 10 yrs', minYears: 5, maxYears: 10 },
  { label: '10 – 20 yrs', minYears: 10, maxYears: 20 },
  { label: '20+ yrs', minYears: 20, maxYears: Number.POSITIVE_INFINITY },
];

export function ByTenureTable() {
  const [emps, setEmps] = useState<Employee[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees?: Employee[] }) => setEmps(j.employees ?? []));
  }, []);

  if (!emps) return <p className="text-sm text-gray-500">Loading…</p>;
  const active = emps.filter((e) => (e.status ?? '').toUpperCase() === 'ACTIVE' && (e.hireDate ?? '').trim());
  if (active.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No active employees with a hireDate on file.
      </p>
    );
  }

  const buckets: Bucket[] = BUCKETS.map((b) => ({ ...b, count: 0 }));
  let unknown = 0;
  const now = new Date();
  for (const e of active) {
    const hd = new Date(e.hireDate as string);
    if (Number.isNaN(hd.getTime())) { unknown += 1; continue; }
    const years = (now.getTime() - hd.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    let placed = false;
    for (const b of buckets) {
      if (years >= b.minYears && years < b.maxYears) {
        b.count += 1;
        placed = true;
        break;
      }
    }
    if (!placed) unknown += 1;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Tenure</th>
            <th className="px-3 py-2 text-right">Employees</th>
            <th className="px-3 py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.label} className="border-t border-gray-100">
              <td className="px-3 py-2 font-semibold">{b.label}</td>
              <td className="px-3 py-2 text-right font-mono">{b.count}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{active.length > 0 ? `${((b.count / active.length) * 100).toFixed(1)}%` : '—'}</td>
            </tr>
          ))}
          {unknown > 0 ? (
            <tr className="border-t border-gray-100">
              <td className="px-3 py-2 font-semibold">(unknown)</td>
              <td className="px-3 py-2 text-right font-mono">{unknown}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">—</td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total active</td>
            <td className="px-3 py-2 text-right font-mono">{active.length}</td>
            <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
