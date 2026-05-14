'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; status?: string; createdAt?: string }

export function ThisYearStats() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) return <p className="text-sm text-gray-500">Loading…</p>;
  const currentYear = String(new Date().getFullYear());
  const inYear = jobs.filter((j) => (j.createdAt ?? '').slice(0, 4) === currentYear);

  if (inYear.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No jobs created in {currentYear} yet.
      </p>
    );
  }

  const counts = new Map<string, number>();
  for (const j of inYear) {
    const k = (j.status ?? '(unknown)') || '(unknown)';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-xs text-gray-500">{currentYear}</div>
        <div className="text-2xl font-bold text-yge-blue-900">{inYear.length} job{inYear.length === 1 ? '' : 's'} created</div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Count</th>
              <th className="px-3 py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <tr key={status} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono font-semibold">{status}</td>
                <td className="px-3 py-2 text-right font-mono">{count}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">{((count / inYear.length) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
