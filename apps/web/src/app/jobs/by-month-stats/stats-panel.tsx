'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; createdAt?: string }

export function ByMonthStats() {
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

  const counts = new Map<string, number>();
  for (const j of jobs) {
    const m = (j.createdAt ?? '').slice(0, 7) || '(unknown)';
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const total = jobs.length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Month</th>
            <th className="px-3 py-2 text-right">Jobs</th>
            <th className="px-3 py-2 text-right">Share</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([month, count]) => (
            <tr key={month} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono font-semibold">{month}</td>
              <td className="px-3 py-2 text-right font-mono">{count}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{((count / total) * 100).toFixed(1)}%</td>
              <td className="px-3 py-2 text-right">
                <Link href="/jobs/by-month-detail" className="text-xs text-yge-blue-700 hover:underline">view</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
