'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  projectName?: string;
  jobNumber?: string;
  status?: string;
  ownerAgency?: string | null;
  createdAt?: string;
}

export function ByYearDetail() {
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

  const groups = new Map<string, Job[]>();
  for (const j of jobs) {
    const y = (j.createdAt ?? '').slice(0, 4) || '(unknown)';
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y)!.push(j);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-3">
      {sorted.map(([year, list]) => {
        const awarded = list.filter((j) => j.status === 'AWARDED' || j.status === 'ACTIVE' || j.status === 'CLOSED').length;
        return (
          <details key={year} className="rounded border border-gray-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
              <span className="font-mono font-semibold">{year}</span>
              <span className="text-xs text-gray-600">{list.length} job{list.length === 1 ? '' : 's'} · {awarded} awarded</span>
            </summary>
            <ul className="divide-y divide-gray-100 px-3 pb-2 text-sm">
              {[...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-1.5">
                  <Link href={`/jobs/${j.id}`} className="font-medium text-yge-blue-700 hover:underline">
                    {j.projectName ?? j.id}
                  </Link>
                  <span className="font-mono text-[10px] text-gray-500">{j.jobNumber ?? ''} · {j.status ?? ''}</span>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
