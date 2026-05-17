'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  startDate?: string | null;
  contractAwardDate?: string | null;
}

function monthKey(j: Job): string {
  const d = j.startDate ?? j.contractAwardDate;
  if (!d) return 'unknown';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 'unknown';
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function PrintMonthPanel() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const buckets = new Map<string, number>();
  for (const j of jobs) {
    const k = monthKey(j);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const rows = Array.from(buckets.entries()).sort((a, b) => {
    if (a[0] === 'unknown') return 1;
    if (b[0] === 'unknown') return -1;
    return a[0] < b[0] ? 1 : -1;
  });

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-300 text-left text-[11px] uppercase tracking-wide text-gray-600">
        <tr>
          <th className="py-2">Month</th>
          <th className="py-2 text-right">Jobs</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {rows.map(([m, n]) => (
          <tr key={m}>
            <td className="py-2 font-mono text-xs text-gray-900">{m}</td>
            <td className="py-2 text-right font-semibold">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
