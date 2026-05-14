'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; status: string; updatedAt?: string; createdAt?: string }

export function ClosedByYearTable() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) return <p className="text-sm text-gray-500">Loading…</p>;
  const closed = jobs.filter((j) => j.status === 'CLOSED');
  if (closed.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No closed jobs yet.
      </p>
    );
  }

  const counts = new Map<string, number>();
  for (const j of closed) {
    const y = (j.updatedAt ?? j.createdAt ?? '').slice(0, 4) || '(unknown)';
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2 text-right">Closed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([y, count]) => (
            <tr key={y} className="border-t border-gray-100">
              <td className="px-3 py-2 font-semibold">{y}</td>
              <td className="px-3 py-2 text-right font-mono">{count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right font-mono">{closed.length}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
