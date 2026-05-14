'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  createdAt: string;
  status: string;
}

interface MonthBucket {
  month: string;
  total: number;
  awarded: number;
  lost: number;
}

export function JobsByMonthTable() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) return <p className="text-sm text-gray-500">Loading…</p>;
  if (jobs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No jobs in the database yet.
      </p>
    );
  }

  const buckets = new Map<string, MonthBucket>();
  for (const j of jobs) {
    const month = (j.createdAt ?? '').slice(0, 7); // yyyy-mm
    if (!month) continue;
    let b = buckets.get(month);
    if (!b) {
      b = { month, total: 0, awarded: 0, lost: 0 };
      buckets.set(month, b);
    }
    b.total += 1;
    if (j.status === 'AWARDED' || j.status === 'ACTIVE' || j.status === 'CLOSED') b.awarded += 1;
    if (j.status === 'LOST') b.lost += 1;
  }
  const months = [...buckets.values()].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Month</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Awarded</th>
            <th className="px-3 py-2 text-right">Lost</th>
            <th className="px-3 py-2 text-right">Hit rate</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const decided = m.awarded + m.lost;
            const hr = decided > 0 ? m.awarded / decided : 0;
            return (
              <tr key={m.month} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono font-semibold">{m.month}</td>
                <td className="px-3 py-2 text-right font-mono">{m.total}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{m.awarded}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{m.lost}</td>
                <td className="px-3 py-2 text-right font-mono">{decided > 0 ? `${(hr * 100).toFixed(0)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
