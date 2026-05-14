'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; status?: string | null; rateType?: string | null }

export function CrossTab() {
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

  const grid = new Map<string, Map<string, number>>();
  const statuses = new Set<string>();
  const rateTypes = new Set<string>();
  for (const j of jobs) {
    const s = (j.status ?? '(unknown)') || '(unknown)';
    const rt = (j.rateType ?? '(unknown)') || '(unknown)';
    statuses.add(s);
    rateTypes.add(rt);
    if (!grid.has(s)) grid.set(s, new Map());
    const row = grid.get(s)!;
    row.set(rt, (row.get(rt) ?? 0) + 1);
  }
  const statusOrder = ['PROSPECT', 'PURSUING', 'BID_SUBMITTED', 'AWARDED', 'ACTIVE', 'CLOSED', 'LOST', 'NO_BID', 'ARCHIVED'];
  const sortedStatuses = [...statuses].sort((a, b) => {
    const ai = statusOrder.indexOf(a); const bi = statusOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  const sortedRateTypes = [...rateTypes].sort();

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Status \\ Rate type</th>
            {sortedRateTypes.map((rt) => (
              <th key={rt} className="px-3 py-2 text-right font-mono">{rt}</th>
            ))}
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sortedStatuses.map((s) => {
            const row = grid.get(s) ?? new Map<string, number>();
            const rowTotal = [...row.values()].reduce((a, b) => a + b, 0);
            return (
              <tr key={s} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono font-semibold">{s}</td>
                {sortedRateTypes.map((rt) => (
                  <td key={rt} className="px-3 py-2 text-right font-mono">{row.get(rt) ?? 0}</td>
                ))}
                <td className="px-3 py-2 text-right font-mono font-semibold">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
