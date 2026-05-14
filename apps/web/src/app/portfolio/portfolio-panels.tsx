'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface JobsStats { total: number; byStatus: Record<string, number>; byRateType: Record<string, number> }
interface BidStats {
  lifetime: { total: number; won: number; lost: number; wonCents: number; tbd: number; noAward: number };
  years: Array<{ year: number; total: number; won: number; lost: number; wonCents: number }>;
}
interface DataStatusResp { rows?: Array<{ entity: string; count: number }> }

export function PortfolioPanels() {
  const [jobs, setJobs] = useState<JobsStats | null>(null);
  const [bids, setBids] = useState<BidStats | null>(null);
  const [data, setData] = useState<DataStatusResp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: JobsStats | null) => setJobs(j));
    fetch(`${apiBaseUrl()}/api/bid-results/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: BidStats | null) => setBids(j));
    fetch(`${apiBaseUrl()}/api/admin/data-status`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: DataStatusResp | null) => setData(j));
  }, []);

  if (!jobs || !bids || !data) return <p className="text-sm text-gray-500">Loading…</p>;

  const winDecided = bids.lifetime.won + bids.lifetime.lost;
  const winRate = winDecided > 0 ? bids.lifetime.won / winDecided : 0;
  const counts: Record<string, number> = {};
  for (const r of data.rows ?? []) counts[r.entity] = r.count;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Lifetime</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Jobs in system" value={jobs.total} href="/jobs" />
          <Tile label="Bid tabs tracked" value={bids.lifetime.total} href="/bid-results" />
          <Tile label="Lifetime wins" value={bids.lifetime.won} href="/bid-results/wins" tone="good" />
          <Tile label="Lifetime won $" value={<Money cents={bids.lifetime.wonCents} />} href="/bid-results/by-year" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Today's pipeline</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Pursuing" value={jobs.byStatus['PURSUING'] ?? 0} href="/jobs/board" />
          <Tile label="Bid submitted" value={jobs.byStatus['BID_SUBMITTED'] ?? 0} href="/jobs/active" />
          <Tile label="Awarded" value={jobs.byStatus['AWARDED'] ?? 0} href="/jobs/awarded" tone="good" />
          <Tile label="Win rate" value={`${(winRate * 100).toFixed(0)}%`} href="/bid-results/by-year" tone={winRate >= 0.25 ? 'good' : winRate >= 0.15 ? 'warn' : 'bad'} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Master data</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <Tile label="Customers" value={counts.customers ?? 0} href="/customers" />
          <Tile label="Vendors" value={counts.vendors ?? 0} href="/vendors" />
          <Tile label="Employees" value={counts.employees ?? 0} href="/employees" />
          <Tile label="Materials" value={counts.materials ?? 0} href="/materials" />
          <Tile label="Equipment" value={counts.equipment ?? counts.equipmentRates ?? 0} href="/equipment-rates" />
          <Tile label="Cost codes" value={counts.costCodes ?? 0} href="/cost-codes" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Drill in</h2>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <li><Link href="/dashboard/morning-briefing" className="text-yge-blue-700 hover:underline">Morning briefing</Link></li>
          <li><Link href="/dashboard/last-7-days" className="text-yge-blue-700 hover:underline">Last 7 days snapshot</Link></li>
          <li><Link href="/dashboard/this-month" className="text-yge-blue-700 hover:underline">This month snapshot</Link></li>
          <li><Link href="/bid-results/top-competitors" className="text-yge-blue-700 hover:underline">Top competitors</Link></li>
          <li><Link href="/jobs/by-year" className="text-yge-blue-700 hover:underline">Jobs by year</Link></li>
          <li><Link href="/jobs/by-owner-agency" className="text-yge-blue-700 hover:underline">Jobs by owner agency</Link></li>
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
