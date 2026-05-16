'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  startDate?: string | null;
}

function monthKey(d?: string | null): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function MonthStartedStatsPanel() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const counts = new Map<string, number>();
  let missing = 0;
  for (const j of jobs) {
    const k = monthKey(j.startDate);
    if (k === null) {
      missing += 1;
    } else {
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat label="Busiest month" value={top ? top[0] : '—'} sub={top ? `${top[1]} jobs` : 'no jobs dated yet'} />
      <Stat label="Unique months" value={String(counts.size)} sub={`across ${jobs.length - missing} jobs`} />
      <Stat label="Missing start date" value={String(missing)} sub={`of ${jobs.length} jobs`} tone={missing > 0 ? 'warn' : 'good'} />
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
