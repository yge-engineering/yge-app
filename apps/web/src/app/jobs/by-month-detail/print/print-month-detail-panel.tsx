'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  name?: string | null;
  jobNumber?: string | null;
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

export function PrintMonthDetailPanel() {
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
    const k = monthKey(j);
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
    return <p className="text-xs text-gray-500">No jobs yet.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map(([m, list]) => (
        <section key={m} className="break-inside-avoid">
          <h2 className="border-b border-gray-300 pb-1 font-mono text-sm font-semibold text-gray-900">
            {m} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="mt-1 space-y-0.5 text-xs">
            {list.map((j) => (
              <li key={j.id} className="flex items-center justify-between">
                <span className="text-gray-900">{j.jobNumber ? `${j.jobNumber} · ` : ''}{j.name ?? '— unnamed —'}</span>
                <span className="font-mono text-gray-500">{j.startDate ?? j.contractAwardDate ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
