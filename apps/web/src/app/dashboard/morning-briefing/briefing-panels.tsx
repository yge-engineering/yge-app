'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Resp {
  total: number;
  byStatus: Record<string, number>;
}

interface BidStats {
  lifetime: { total: number; won: number; lost: number; wonCents: number };
}

export function MorningBriefingPanels() {
  const [jobs, setJobs] = useState<Resp | null>(null);
  const [bids, setBids] = useState<BidStats | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setJobs(j));
    fetch(`${apiBaseUrl()}/api/bid-results/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: BidStats | null) => setBids(j));
  }, []);

  if (!jobs || !bids) return <p className="text-sm text-gray-500">Loading…</p>;

  const active = (jobs.byStatus['AWARDED'] ?? 0) + (jobs.byStatus['BID_SUBMITTED'] ?? 0) + (jobs.byStatus['ACTIVE'] ?? 0);
  const pursuing = (jobs.byStatus['PURSUING'] ?? 0) + (jobs.byStatus['BID_SUBMITTED'] ?? 0);
  const winDecided = bids.lifetime.won + bids.lifetime.lost;
  const winRate = winDecided > 0 ? bids.lifetime.won / winDecided : 0;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pipeline</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Jobs in system" value={jobs.total} href="/jobs" />
          <Tile label="Active" value={active} href="/jobs/active" tone="good" />
          <Tile label="Pursuing" value={pursuing} href="/jobs/board" />
          <Tile label="Lost" value={jobs.byStatus['LOST'] ?? 0} href="/jobs/by-status" tone="bad" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Bid history</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Bids tracked" value={bids.lifetime.total} href="/bid-results" />
          <Tile label="Lifetime wins" value={bids.lifetime.won} href="/bid-results/biggest-wins" tone="good" />
          <Tile label="Win rate" value={`${(winRate * 100).toFixed(0)}%`} href="/bid-results/by-year" tone={winRate >= 0.25 ? 'good' : winRate >= 0.15 ? 'warn' : 'bad'} />
          <Tile label="Lifetime won $" value={<Money cents={bids.lifetime.wonCents} />} href="/bid-results/by-year" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Shortcuts</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li><Link href="/quick-tools" className="text-yge-blue-700 hover:underline">All analytic + utility pages</Link></li>
          <li><Link href="/admin/data-quality" className="text-yge-blue-700 hover:underline">Data quality cleanup</Link></li>
          <li><Link href="/jobs/recent" className="text-yge-blue-700 hover:underline">Recently-touched jobs</Link></li>
          <li><Link href="/bid-results/recent" className="text-yge-blue-700 hover:underline">Recent bid results</Link></li>
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: 'good' | 'bad' | 'warn' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-yge-blue-900';
  const inner = (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href} className="block hover:bg-gray-50">{inner}</Link> : inner;
}
