'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; createdAt?: string }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ByDayOfWeekTable() {
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
        No jobs yet.
      </p>
    );
  }

  const counts: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const j of jobs) {
    const d = new Date(j.createdAt ?? '');
    if (Number.isNaN(d.getTime())) continue;
    const dow = d.getDay();
    counts[dow] = (counts[dow] ?? 0) + 1;
  }
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Weekday</th>
            <th className="px-3 py-2 text-right">Jobs</th>
            <th className="px-3 py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {DAY_NAMES.map((name, i) => {
            const c = counts[i] ?? 0;
            return (
              <tr key={name} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{name}</td>
                <td className="px-3 py-2 text-right font-mono">{c}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">{total > 0 ? `${((c / total) * 100).toFixed(1)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right font-mono">{total}</td>
            <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
