'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  name?: string | null;
  jobNumber?: string | null;
  status?: string | null;
}

export function PrintStatusDetailPanel() {
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
    const k = j.status ?? '— unknown —';
    const list = grouped.get(k);
    if (list) list.push(j);
    else grouped.set(k, [j]);
  }
  const sections = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);

  if (sections.length === 0) {
    return <p className="text-xs text-gray-500">No jobs yet.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map(([s, list]) => (
        <section key={s} className="break-inside-avoid">
          <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold text-gray-900">
            {s} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="mt-1 space-y-0.5 text-xs">
            {list.map((j) => (
              <li key={j.id} className="text-gray-900">
                {j.jobNumber ? `${j.jobNumber} · ` : ''}{j.name ?? '— unnamed —'}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
