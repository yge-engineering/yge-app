'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; status: string; createdAt?: string }

export function ActiveByYearTable() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) return <p className="text-sm text-gray-500">Loading…</p>;
  const active = jobs.filter((j) => j.status === 'AWARDED' || j.status === 'BID_SUBMITTED');
  if (active.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No active or awarded jobs.
      </p>
    );
  }

  const counts = new Map<string, number>();
  for (const j of active) {
    const y = (j.createdAt ?? '').slice(0, 4) || '(unknown)';
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Year created</th>
            <th className="px-3 py-2 text-right">Jobs</th>
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
            <td className="px-3 py-2">Total active</td>
            <td className="px-3 py-2 text-right font-mono">{active.length}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
