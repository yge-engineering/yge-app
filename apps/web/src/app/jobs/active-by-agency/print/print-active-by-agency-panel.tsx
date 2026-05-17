'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  status?: string | null;
  ownerAgency?: string | null;
}

export function PrintActiveByAgencyPanel() {
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
    if (j.status?.toUpperCase() !== 'ACTIVE') continue;
    const k = j.ownerAgency?.trim() || '— none —';
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const rows = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-300 text-left text-[11px] uppercase tracking-wide text-gray-600">
        <tr>
          <th className="py-2">Owner agency</th>
          <th className="py-2 text-right">Active</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {rows.map(([a, n]) => (
          <tr key={a}>
            <td className="py-2 text-gray-900">{a}</td>
            <td className="py-2 text-right font-semibold">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
