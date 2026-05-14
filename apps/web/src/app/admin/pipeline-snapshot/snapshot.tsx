'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Resp { total: number; byStatus: Record<string, number> }

const STAGES: Array<{ key: string; label: string; href: string; tone: 'neutral' | 'good' | 'bad' | 'warn' }> = [
  { key: 'PROSPECT', label: 'Prospect', href: '/jobs/prospect', tone: 'neutral' },
  { key: 'PURSUING', label: 'Pursuing', href: '/jobs/pursuing', tone: 'neutral' },
  { key: 'BID_SUBMITTED', label: 'Bid submitted', href: '/jobs/bid-submitted', tone: 'warn' },
  { key: 'AWARDED', label: 'Awarded', href: '/jobs/awarded', tone: 'good' },
  { key: 'ACTIVE', label: 'Active', href: '/jobs/active', tone: 'good' },
  { key: 'CLOSED', label: 'Closed', href: '/jobs/closed', tone: 'good' },
  { key: 'LOST', label: 'Lost', href: '/jobs/lost', tone: 'bad' },
  { key: 'NO_BID', label: 'No bid', href: '/jobs/no-bid', tone: 'neutral' },
  { key: 'ARCHIVED', label: 'Archived', href: '/jobs/archived', tone: 'neutral' },
];

export function PipelineSnapshot() {
  const [stats, setStats] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setStats(j));
  }, []);

  if (!stats) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3">
      {STAGES.map((s) => {
        const count = stats.byStatus[s.key] ?? 0;
        const toneClass =
          s.tone === 'good' ? 'text-green-700'
          : s.tone === 'bad' ? 'text-red-700'
          : s.tone === 'warn' ? 'text-amber-700'
          : 'text-yge-blue-900';
        return (
          <Link key={s.key} href={s.href} className="block hover:bg-gray-50">
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{s.label}</div>
              <div className={`text-3xl font-bold ${toneClass}`}>{count}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
