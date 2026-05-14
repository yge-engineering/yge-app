'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface BidStats { lifetime: { total: number; won: number; lost: number; wonCents: number } }

export function ThreeUp() {
  const [bids, setBids] = useState<BidStats | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: BidStats | null) => setBids(j));
  }, []);

  if (!bids) return <p className="text-sm text-gray-500">Loading…</p>;
  const decided = bids.lifetime.won + bids.lifetime.lost;
  const winRate = decided > 0 ? bids.lifetime.won / decided : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Tile label="Lifetime wins" value={bids.lifetime.won} tone="good" />
      <Tile label="Win rate" value={`${(winRate * 100).toFixed(0)}%`} tone={winRate >= 0.25 ? 'good' : winRate >= 0.15 ? 'warn' : 'bad'} />
      <Tile label="Lifetime won $" value={<Money cents={bids.lifetime.wonCents} />} tone="good" />
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone: 'good' | 'bad' | 'warn' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : 'text-amber-700';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-2 text-5xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
