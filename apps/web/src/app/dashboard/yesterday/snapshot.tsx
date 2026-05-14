'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Bidder { isYge?: boolean; amountCents?: number }
interface BidResult { id: string; bidOpenedAt: string; outcome: string; bidders?: Bidder[] }
interface Job { id: string; createdAt?: string; updatedAt?: string }

export function YesterdayPanel() {
  const [bids, setBids] = useState<BidResult[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results?: BidResult[] }) => setBids(j.results ?? []));
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!bids || !jobs) return <p className="text-sm text-gray-500">Loading…</p>;

  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const ydy = yesterday.toISOString().slice(0, 10);

  const ybids = bids.filter((b) => (b.bidOpenedAt ?? '').startsWith(ydy));
  const wins = ybids.filter((b) => b.outcome === 'WON_BY_YGE');
  const losses = ybids.filter((b) => b.outcome === 'WON_BY_OTHER');
  const wonCents = wins.reduce((sum, b) => {
    const yge = (b.bidders ?? []).find((x) => x.isYge);
    return sum + (yge?.amountCents ?? 0);
  }, 0);
  const newJobs = jobs.filter((j) => (j.createdAt ?? '').startsWith(ydy));
  const touched = jobs.filter((j) => (j.updatedAt ?? '').startsWith(ydy));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{ydy}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Bid tabs" value={ybids.length} href="/bid-results" />
          <Tile label="Wins" value={wins.length} href="/bid-results/wins" tone="good" />
          <Tile label="Losses" value={losses.length} href="/bid-results/losses" tone="bad" />
          <Tile label="Won $" value={<Money cents={wonCents} />} href="/bid-results/by-month" />
          <Tile label="New jobs" value={newJobs.length} href="/jobs/recent" />
          <Tile label="Jobs touched" value={touched.length} href="/jobs/recent" />
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, href, tone }: { label: string; value: React.ReactNode; href: string; tone?: 'good' | 'bad' | 'warn' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-yge-blue-900';
  return (
    <Link href={href} className="block hover:bg-gray-50">
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      </div>
    </Link>
  );
}
