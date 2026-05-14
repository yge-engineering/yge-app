'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface BidResult {
  id: string;
  jobId: string;
  bidOpenedAt: string;
  outcome: 'WON_BY_YGE' | 'WON_BY_OTHER' | 'NO_AWARD' | 'TBD';
  bidders?: Array<{ name?: string; amountCents?: number; isYge?: boolean }>;
}

export function BidSummaryTile() {
  const [results, setResults] = useState<BidResult[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results?: BidResult[] }) => setResults(j.results ?? []));
  }, []);

  if (!results) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Bid history
        </h2>
        <p className="text-sm text-gray-500">Loading…</p>
      </section>
    );
  }

  const total = results.length;
  const won = results.filter((r) => r.outcome === 'WON_BY_YGE').length;
  const lost = results.filter((r) => r.outcome === 'WON_BY_OTHER').length;
  const decided = won + lost;
  const winRate = decided > 0 ? won / decided : 0;
  const currentYear = new Date().getFullYear();
  const now = new Date();
  const currentMonth = now.getMonth();
  const thisMonthWon = results.filter((r) =>
    r.outcome === 'WON_BY_YGE' &&
    new Date(r.bidOpenedAt).getMonth() === currentMonth &&
    new Date(r.bidOpenedAt).getFullYear() === now.getFullYear(),
  ).length;
  const thisYearWon = results.filter((r) =>
    r.outcome === 'WON_BY_YGE' &&
    new Date(r.bidOpenedAt).getFullYear() === currentYear,
  );
  const thisYearWonCents = thisYearWon.reduce((sum, r) => {
    const ygeBid = (r.bidders ?? []).find((b) => b.isYge);
    return sum + (ygeBid?.amountCents ?? 0);
  }, 0);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Bid history
        </h2>
        <Link
          href="/bid-results"
          className="rounded border border-yge-blue-500 px-2 py-0.5 text-[11px] font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          All →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Bids tracked" value={total} />
        <Stat label="Win rate" value={`${(winRate * 100).toFixed(0)}%`} tone={winRate >= 0.3 ? 'good' : winRate >= 0.15 ? 'warn' : 'bad'} />
        <Stat label={`${currentYear} wins`} value={thisYearWon.length} />
        <Stat label={`${currentYear} won $`} value={<Money cents={thisYearWonCents} />} />
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-700' : 'text-yge-blue-900';
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
