'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; createdAt?: string; updatedAt?: string }
interface BidResult { id: string; bidOpenedAt?: string; outcome?: string }
interface Vendor { id: string; createdAt?: string }
interface Customer { id: string; createdAt?: string }

export function Last7DaysSnapshot() {
  const [data, setData] = useState<{ newJobs: number; touchedJobs: number; bids: number; wins: number; vendors: number; customers: number } | null>(null);

  useEffect(() => {
    (async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const iso = cutoff.toISOString().slice(0, 10);
      try {
        const [jr, br, vr, cr] = await Promise.all([
          fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
        ]);
        const jobs: Job[] = jr?.jobs ?? [];
        const bids: BidResult[] = br?.results ?? [];
        const vendors: Vendor[] = vr?.vendors ?? [];
        const customers: Customer[] = cr?.customers ?? [];

        const newJobs = jobs.filter((j) => (j.createdAt ?? '') >= iso).length;
        const touchedJobs = jobs.filter((j) => (j.updatedAt ?? '') >= iso).length;
        const bidsCount = bids.filter((b) => (b.bidOpenedAt ?? '') >= iso).length;
        const winsCount = bids.filter((b) => (b.bidOpenedAt ?? '') >= iso && b.outcome === 'WON_BY_YGE').length;
        const vendorsCount = vendors.filter((v) => (v.createdAt ?? '') >= iso).length;
        const customersCount = customers.filter((c) => (c.createdAt ?? '') >= iso).length;

        setData({ newJobs, touchedJobs, bids: bidsCount, wins: winsCount, vendors: vendorsCount, customers: customersCount });
      } catch {
        setData({ newJobs: 0, touchedJobs: 0, bids: 0, wins: 0, vendors: 0, customers: 0 });
      }
    })();
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
      <Tile label="New jobs" value={data.newJobs} href="/jobs/recent" />
      <Tile label="Touched jobs" value={data.touchedJobs} href="/jobs/recent" />
      <Tile label="Bid tabs" value={data.bids} href="/bid-results/last-30-days" />
      <Tile label="Wins" value={data.wins} href="/bid-results/biggest-wins" tone="good" />
      <Tile label="New vendors" value={data.vendors} href="/vendors/recent" />
      <Tile label="New customers" value={data.customers} href="/customers/recent" />
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
