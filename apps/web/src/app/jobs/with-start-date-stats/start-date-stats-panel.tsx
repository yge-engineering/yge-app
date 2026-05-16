'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  startDate?: string | null;
}

export function StartDateStatsPanel() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const total = jobs.length;
  const withDate = jobs.filter((j) => !!j.startDate).length;
  const missing = total - withDate;
  const pct = total === 0 ? 0 : (withDate / total) * 100;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="With start date" value={String(withDate)} sub={`of ${total} jobs`} tone={pct >= 90 ? 'good' : pct >= 60 ? 'warn' : 'bad'} />
        <Stat label="Missing" value={String(missing)} sub={`${(100 - pct).toFixed(0)}% blank`} tone={missing === 0 ? 'good' : missing < 5 ? 'warn' : 'bad'} />
        <Stat label="Completeness" value={`${pct.toFixed(0)}%`} sub={pct >= 90 ? 'looks great' : pct >= 60 ? 'needs cleanup' : 'urgent backlog'} tone={pct >= 90 ? 'good' : pct >= 60 ? 'warn' : 'bad'} />
      </div>
      <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
        <div className="h-3 w-full overflow-hidden rounded bg-gray-100">
          <div className={pct >= 90 ? 'h-full bg-green-500' : pct >= 60 ? 'h-full bg-amber-500' : 'h-full bg-red-500'} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'warn' | 'bad' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-700' : 'text-yge-blue-900';
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-gray-500">{sub}</div>
    </div>
  );
}
