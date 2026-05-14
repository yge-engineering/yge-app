'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; status?: string; ownerAgency?: string | null }

export function ActiveByAgencyTable() {
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
    const k = (j.ownerAgency ?? '').trim() || '(unknown)';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Owner agency</th>
            <th className="px-3 py-2 text-right">Active / awarded jobs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([agency, count]) => (
            <tr key={agency} className="border-t border-gray-100">
              <td className="px-3 py-2 font-semibold">{agency}</td>
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
