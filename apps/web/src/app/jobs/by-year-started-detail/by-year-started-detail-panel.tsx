'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  name?: string | null;
  jobNumber?: string | null;
  startDate?: string | null;
}

function yearKey(d?: string | null): string {
  if (!d) return 'unknown';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 'unknown';
  return String(dt.getUTCFullYear());
}

export function ByYearStartedDetailPanel() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const grouped = new Map<string, Job[]>();
  for (const j of jobs) {
    const k = yearKey(j.startDate);
    const list = grouped.get(k);
    if (list) list.push(j);
    else grouped.set(k, [j]);
  }
  const sections = Array.from(grouped.entries()).sort((a, b) => {
    if (a[0] === 'unknown') return 1;
    if (b[0] === 'unknown') return -1;
    return a[0] < b[0] ? 1 : -1;
  });

  if (sections.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500">
        No jobs yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map(([year, list]) => (
        <section key={year} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 font-mono text-sm text-yge-blue-900">
            {year} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="space-y-1">
            {list.map((j) => (
              <li key={j.id} className="flex items-center justify-between text-xs">
                <Link href={`/jobs/${j.id}`} className="text-yge-blue-700 hover:underline">
                  {j.jobNumber ? `${j.jobNumber} · ` : ''}{j.name ?? '— unnamed —'}
                </Link>
                <span className="font-mono text-gray-500">{j.startDate ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
