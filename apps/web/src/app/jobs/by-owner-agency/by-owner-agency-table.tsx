'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; ownerAgency?: string | null; status: string }

interface Row { agency: string; total: number; awarded: number; lost: number }

export function ByOwnerAgencyTable() {
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

  const map = new Map<string, Row>();
  for (const j of jobs) {
    const k = (j.ownerAgency ?? '').trim() || '(unknown)';
    let r = map.get(k);
    if (!r) { r = { agency: k, total: 0, awarded: 0, lost: 0 }; map.set(k, r); }
    r.total += 1;
    if (j.status === 'AWARDED' || j.status === 'ACTIVE' || j.status === 'CLOSED') r.awarded += 1;
    if (j.status === 'LOST') r.lost += 1;
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Owner agency</th>
            <th className="px-3 py-2 text-right">Total jobs</th>
            <th className="px-3 py-2 text-right">Awarded</th>
            <th className="px-3 py-2 text-right">Lost</th>
            <th className="px-3 py-2 text-right">Hit rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const decided = r.awarded + r.lost;
            const hr = decided > 0 ? r.awarded / decided : 0;
            return (
              <tr key={r.agency} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold text-gray-900">{r.agency}</td>
                <td className="px-3 py-2 text-right font-mono">{r.total}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{r.awarded}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{r.lost}</td>
                <td className="px-3 py-2 text-right font-mono">{decided > 0 ? `${(hr * 100).toFixed(0)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
