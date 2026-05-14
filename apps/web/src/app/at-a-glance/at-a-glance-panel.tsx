'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface JobsStats { total: number; byStatus: Record<string, number> }
interface BidStats { lifetime: { total: number; won: number; lost: number; wonCents: number } }
interface Job { id: string; createdAt?: string; updatedAt?: string }
interface BidResult { id: string; bidOpenedAt: string; outcome: string; bidders?: Array<{ isYge?: boolean; amountCents?: number }> }

export function AtAGlancePanel() {
  const [jobsStats, setJobsStats] = useState<JobsStats | null>(null);
  const [bidStats, setBidStats] = useState<BidStats | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [bids, setBids] = useState<BidResult[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/stats`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setJobsStats);
    fetch(`${apiBaseUrl()}/api/bid-results/stats`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setBidStats);
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { jobs: [] })).then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { results: [] })).then((j: { results?: BidResult[] }) => setBids(j.results ?? []));
  }, []);

  if (!jobsStats || !bidStats || !jobs || !bids) return <p className="text-sm text-gray-500">Loading…</p>;

  const now = new Date();
  const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10);

  const thisMonthBids = bids.filter((b) => (b.bidOpenedAt ?? '').startsWith(yyyyMm));
  const wins = thisMonthBids.filter((b) => b.outcome === 'WON_BY_YGE');
  const wonCents = wins.reduce((sum, b) => {
    const yge = (b.bidders ?? []).find((x) => x.isYge);
    return sum + (yge?.amountCents ?? 0);
  }, 0);
  const touchedToday = jobs.filter((j) => (j.updatedAt ?? '').startsWith(today)).length;
  const winDecided = bidStats.lifetime.won + bidStats.lifetime.lost;
  const winRate = winDecided > 0 ? bidStats.lifetime.won / winDecided : 0;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Lifetime</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Jobs" value={jobsStats.total} href="/jobs" />
          <Tile label="Bids tracked" value={bidStats.lifetime.total} href="/bid-results" />
          <Tile label="Win rate" value={`${(winRate * 100).toFixed(0)}%`} href="/bid-results/by-year" tone={winRate >= 0.25 ? 'good' : winRate >= 0.15 ? 'warn' : 'bad'} />
          <Tile label="Lifetime won $" value={<Money cents={bidStats.lifetime.wonCents} />} href="/bid-results/biggest-wins" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">This month</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Bids tracked" value={thisMonthBids.length} href="/bid-results/this-month" />
          <Tile label="Wins" value={wins.length} href="/bid-results/this-month" tone="good" />
          <Tile label="Won $" value={<Money cents={wonCents} />} href="/bid-results/by-month" />
          <Tile label="Touched today" value={touchedToday} href="/jobs/today" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pipeline now</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Pursuing" value={jobsStats.byStatus['PURSUING'] ?? 0} href="/jobs/pursuing" />
          <Tile label="Bid submitted" value={jobsStats.byStatus['BID_SUBMITTED'] ?? 0} href="/jobs/bid-submitted" tone="warn" />
          <Tile label="Awarded" value={jobsStats.byStatus['AWARDED'] ?? 0} href="/jobs/awarded" tone="good" />
          <Tile label="Lost" value={jobsStats.byStatus['LOST'] ?? 0} href="/jobs/lost" tone="bad" />
        </div>
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
