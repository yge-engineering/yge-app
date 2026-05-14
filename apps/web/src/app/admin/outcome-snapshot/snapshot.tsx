'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const OUTCOMES: Array<{ key: string; label: string; href: string; tone: 'good' | 'bad' | 'warn' | 'neutral' }> = [
  { key: 'WON_BY_YGE', label: 'Won by YGE', href: '/bid-results/wins', tone: 'good' },
  { key: 'WON_BY_OTHER', label: 'Won by other', href: '/bid-results/losses', tone: 'bad' },
  { key: 'NO_AWARD', label: 'No award', href: '/bid-results/no-award', tone: 'neutral' },
  { key: 'TBD', label: 'TBD', href: '/bid-results/tbd', tone: 'warn' },
];

export function OutcomeSnapshot() {
  const [results, setResults] = useState<BidResult[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results?: BidResult[] }) => setResults(j.results ?? []));
  }, []);

  if (!results) return <p className="text-sm text-gray-500">Loading…</p>;
  const counts = new Map<string, number>();
  for (const r of results) counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + 1);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {OUTCOMES.map((o) => {
        const count = counts.get(o.key) ?? 0;
        const toneClass =
          o.tone === 'good' ? 'text-green-700'
          : o.tone === 'bad' ? 'text-red-700'
          : o.tone === 'warn' ? 'text-amber-700'
          : 'text-yge-blue-900';
        return (
          <Link key={o.key} href={o.href} className="block hover:bg-gray-50">
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{o.label}</div>
              <div className={`text-3xl font-bold ${toneClass}`}>{count}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
